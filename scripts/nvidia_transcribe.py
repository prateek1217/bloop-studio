#!/usr/bin/env python3
"""
Thin CLI wrapper around NVIDIA's official `nvidia-riva-client` package.

Called as a subprocess from src/lib/stt/nvidiaParakeetProvider.ts. Kept as a
small Python helper instead of hand-rolling the Riva gRPC/protobuf wire
format in Node, since NVIDIA maintains this client and it already implements
RecognitionConfig/WordInfo correctly. Word-level timestamps for the Parakeet
models are only available via this gRPC API, not the HTTP REST endpoint.

Usage: python nvidia_transcribe.py <wav_path> [language_code]
Env:   NVIDIA_API_KEY, NVIDIA_FUNCTION_ID
Prints exactly one line of JSON to stdout: {"words": [...], "language": "..."}
On failure, prints {"error": "..."} to stderr and exits 1.
"""
import sys
import os
import json


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: nvidia_transcribe.py <wav_path> [language_code]"}), file=sys.stderr)
        return 1

    wav_path = sys.argv[1]
    language_code = sys.argv[2] if len(sys.argv) > 2 else "en-US"

    api_key = os.environ.get("NVIDIA_API_KEY")
    function_id = os.environ.get("NVIDIA_FUNCTION_ID")
    if not api_key or not function_id:
        print(json.dumps({"error": "NVIDIA_API_KEY and NVIDIA_FUNCTION_ID must be set"}), file=sys.stderr)
        return 1

    import riva.client  # imported lazily so the checks above don't require it installed just to fail fast

    auth = riva.client.Auth(
        use_ssl=True,
        uri="grpc.nvcf.nvidia.com:443",
        metadata_args=[("function-id", function_id), ("authorization", f"Bearer {api_key}")],
    )
    asr_service = riva.client.ASRService(auth)

    config = riva.client.RecognitionConfig(
        language_code=language_code,
        model="",
        max_alternatives=1,
        profanity_filter=False,
        enable_automatic_punctuation=True,
        verbatim_transcripts=True,
        enable_word_time_offsets=True,
    )

    with open(wav_path, "rb") as fh:
        data = fh.read()

    response = asr_service.offline_recognize(data, config)

    words = []
    for result in response.results:
        if not result.alternatives:
            continue
        for w in result.alternatives[0].words:
            words.append({"text": w.word, "start": w.start_time / 1000.0, "end": w.end_time / 1000.0})

    print(json.dumps({"words": words, "language": language_code}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # surfaced to the Node caller as a clean error message
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)

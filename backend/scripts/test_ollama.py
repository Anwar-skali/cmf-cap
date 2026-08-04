"""Quick Ollama connectivity test for the backend environment."""
import asyncio
import traceback

import httpx

OLLAMA_URL = "http://localhost:11434"


async def main() -> None:
    try:
        timeout = httpx.Timeout(60.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            print("tags status:", r.status_code)

            models = r.json().get("models", [])
            model = models[0]["name"] if models else "llama3"
            print("using model:", model)

            res = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": 'Return JSON: {"part_number": {"excel": "Part Number", "confidence": 0.95}}',
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1},
                },
            )
            print("generate status:", res.status_code)
            if res.status_code != 200:
                print("body:", res.text[:500])
                return
            data = res.json()
            print("response snippet:", (data.get("response") or "")[:300])
    except Exception as e:
        print("ERROR type:", type(e).__name__)
        print("ERROR str:", str(e))
        print("ERROR repr:", repr(e))
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

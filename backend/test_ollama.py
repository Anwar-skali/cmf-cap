import httpx
import asyncio
import time

async def main():
    start = time.time()
    async with httpx.AsyncClient(timeout=90.0) as client:
        res = await client.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3:latest",
                "system": "Output JSON only.",
                "prompt": 'Map ["project_name", "sqe"] to ["Nom Projet", "SQE"]. Format: {"project_name":{"excel":"Nom Projet","confidence":0.99},"sqe":{"excel":"SQE","confidence":0.99}}',
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.0,
                    "num_predict": 100,
                },
                "keep_alive": "15m",
            },
        )
        print("Status:", res.status_code)
        print("Elapsed:", round(time.time() - start, 2), "s")
        print("Response:", res.json().get("response"))

if __name__ == "__main__":
    asyncio.run(main())

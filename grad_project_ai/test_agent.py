import httpx
import asyncio
import json

MOCK_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

async def test_chat_endpoint():
    url = "http://localhost:8000/api/ai/chat"
    payload = {
        "message": "Am I spending too much on food?",
        "accessToken": MOCK_ACCESS_TOKEN
    }
    
    print(f"Sending request to {url}...")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30.0)
            
            print(f"\nStatus Code: {response.status_code}")
            
            if response.status_code == 200:
                print("\nSuccess! AI Response:")
                print(json.dumps(response.json(), indent=2))
            else:
                print("\nError response from server:")
                try:
                    print(json.dumps(response.json(), indent=2))
                except:
                    print(response.text)
                    
    except httpx.RequestError as exc:
        print(f"\nAn error occurred while requesting {exc.request.url!r}.")
        print("Make sure your FastAPI server is running (uvicorn main:app --reload)!")

if __name__ == "__main__":
    asyncio.run(test_chat_endpoint())

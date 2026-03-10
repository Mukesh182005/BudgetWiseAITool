import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app import app
from ai_engine import process_chat_message
from models import User

def test_ai():
    with app.app_context():
        user = User.query.first()
        if not user:
            print("No user found in database.")
            return
        
        print(f"Testing AI for user: {user.email} (ID: {user.id})\n")

        # Test 1: Finance question
        print("=" * 50)
        msg1 = "How is my financial health?"
        print(f"[Finance Q] {msg1}")
        resp1 = process_chat_message(msg1, user.id)
        print(f"Response: {resp1}\n")

        # Test 2: Non-finance question (should be rejected)
        print("=" * 50)
        msg2 = "Tell me a joke about cats"
        print(f"[Non-Finance Q] {msg2}")
        resp2 = process_chat_message(msg2, user.id)
        print(f"Response: {resp2}\n")

        # Test 3: Spending question
        print("=" * 50)
        msg3 = "How much did I spend this month?"
        print(f"[Finance Q] {msg3}")
        resp3 = process_chat_message(msg3, user.id)
        print(f"Response: {resp3}\n")

if __name__ == "__main__":
    test_ai()

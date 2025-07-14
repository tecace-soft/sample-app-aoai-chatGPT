# Create: backend/monitoring_service.py
import httpx
import asyncio
import logging
import json
import uuid
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Import tiktoken for token estimation fallback
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
    # Use the same encoding as in data_utils.py
    TOKENIZER = tiktoken.get_encoding("gpt2")
except ImportError:
    TIKTOKEN_AVAILABLE = False
    TOKENIZER = None

class MonitoringService:
    def __init__(self):
        self.endpoint = "https://monitor.assistace.tecace.com/api/evaluate/async/"
        self.headers = {
            "Accept": "application/json",
            "X-API-Key": "ACCEEE32-332A-4538-926D-5DB03E46DB14",
            "Content-Type": "application/json"
        }
        self.timeout = 10.0  # 10 second timeout

    async def send_evaluation_data(self, evaluation_data: Dict[str, Any]) -> bool:
        """
        Send evaluation data to the monitoring endpoint
        Returns True if successful, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.endpoint,
                    headers=self.headers,
                    json=evaluation_data
                )
                
                if response.status_code in [200, 202]:  # Accept both 200 OK and 202 Accepted
                    logger.info(f"Successfully sent monitoring data for session {evaluation_data.get('session_id')}")
                    return True
                else:
                    logger.error(f"Monitoring API returned status {response.status_code}: {response.text}")
                    return False
                    
        except httpx.TimeoutException:
            logger.error("Timeout sending monitoring data")
            return False
        except Exception as e:
            logger.error(f"Error sending monitoring data: {str(e)}")
            return False

    def extract_user_input(self, messages: List[Dict[str, Any]]) -> str:
        """
        Extract the user's input text from the messages array
        Returns the last user message content
        """
        try:
            # Find the last user message
            for message in reversed(messages):
                if message.get("role") == "user":
                    content = message.get("content", "")
                    if isinstance(content, str):
                        return content
                    elif isinstance(content, list):
                        # Handle content that might be an array (for multimodal)
                        text_parts = []
                        for part in content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                text_parts.append(part.get("text", ""))
                        return " ".join(text_parts)
            return ""
        except Exception as e:
            logger.error(f"Error extracting user input: {str(e)}")
            return ""

    def extract_assistant_output(self, openai_response: Any) -> str:
        """
        Extract the assistant's response text from OpenAI response
        """
        try:
            if hasattr(openai_response, 'choices') and openai_response.choices:
                choice = openai_response.choices[0]
                if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                    return choice.message.content or ""
            return ""
        except Exception as e:
            logger.error(f"Error extracting assistant output: {str(e)}")
            return ""

    def estimate_tokens_fallback(self, text: str) -> int:
        """
        Fallback token estimation using tiktoken when Azure OpenAI doesn't provide usage data
        """
        if not TIKTOKEN_AVAILABLE or not TOKENIZER or not text:
            # Very rough estimation: ~4 characters per token
            return max(1, len(text) // 4)
        
        try:
            return len(TOKENIZER.encode(text, allowed_special="all"))
        except Exception as e:
            logger.error(f"Error in token estimation: {str(e)}")
            # Fallback to character-based estimation
            return max(1, len(text) // 4)

    def extract_token_usage(self, openai_response: Any) -> Dict[str, int]:
        """
        Extract token usage information from OpenAI response
        """
        default_tokens = {
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0
        }
        
        try:
            if hasattr(openai_response, 'usage'):
                usage = openai_response.usage
                if usage:
                    # Try different possible attribute names
                    prompt_tokens = getattr(usage, 'prompt_tokens', None) or getattr(usage, 'input_tokens', 0)
                    completion_tokens = getattr(usage, 'completion_tokens', None) or getattr(usage, 'output_tokens', 0)
                    total_tokens = getattr(usage, 'total_tokens', 0)
                    
                    return {
                        "input_tokens": prompt_tokens,
                        "output_tokens": completion_tokens,
                        "total_tokens": total_tokens
                    }
                
            return default_tokens
        except Exception as e:
            logger.error(f"Error extracting token usage: {str(e)}")
            return default_tokens

    async def capture_and_send_monitoring_data(
        self,
        openai_response: Any,
        messages: List[Dict[str, Any]],
        conversation_id: Optional[str] = None
    ) -> bool:
        """
        Main function to capture all monitoring data and send to endpoint
        """
        try:
            # Generate session ID if not provided
            session_id = conversation_id or str(uuid.uuid4())
            
            # Extract data from response and request
            input_text = self.extract_user_input(messages)
            output_text = self.extract_assistant_output(openai_response)
            token_data = self.extract_token_usage(openai_response)
            
            # Fallback token estimation if Azure OpenAI didn't provide usage data
            if token_data["total_tokens"] == 0 and (input_text or output_text):
                input_tokens = self.estimate_tokens_fallback(input_text) if input_text else 0
                output_tokens = self.estimate_tokens_fallback(output_text) if output_text else 0
                total_tokens = input_tokens + output_tokens
                
                token_data = {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens
                }
            
            # Prepare evaluation data
            evaluation_data = {
                "session_id": session_id,
                "input_text": input_text,
                "output_text": output_text,
                "model": "gpt-4.1-mini",
                "llm_latency": 0,
                "api_latency": 0,
                **token_data  # Includes input_tokens, output_tokens, total_tokens
            }
            
            # Log the data being sent (for debugging)
            logger.info(f"Sending monitoring data for session {session_id}")
            
            # Send data asynchronously
            success = await self.send_evaluation_data(evaluation_data)
            
            return success
            
        except Exception as e:
            logger.error(f"Error in capture_and_send_monitoring_data: {str(e)}")
            return False

# Global monitoring service instance
monitoring_service = MonitoringService()

# Convenience function for easy import
async def send_monitoring_data(
    openai_response: Any,
    messages: List[Dict[str, Any]],
    conversation_id: Optional[str] = None
) -> bool:
    """
    Convenience function to send monitoring data
    """
    return await monitoring_service.capture_and_send_monitoring_data(
        openai_response, messages, conversation_id
    )
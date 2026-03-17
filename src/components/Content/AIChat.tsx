import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey!👋🏽 I'm Mustafa...well, an AI version of me 🤖. Ask me anything about my experience, skills, projects, or background. I'm here to chat! 💬",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(`${API_BASE_URL}/api/rag/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
        signal: controller.signal,
      });
      clearTimeout(t);

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Request failed");

      const assistantMessage: Message = {
        role: "assistant",
        content: data?.message || "I apologize, I couldn't process that request. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error && error.name === "AbortError"
              ? "That took too long — please try again."
              : error instanceof Error
                ? error.message
                : "Sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[60vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3 pb-4 border-b border-border/50"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Mustafa.ai</h2>
          <p className="text-sm text-muted-foreground">I'm so happy to chat with you!</p>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === "user"
                  ? "bg-primary/20"
                  : "bg-gradient-to-br from-primary/50 to-accent/50"
                  }`}
              >
                {message.role === "user" ? (
                  <User className="w-4 h-4 text-primary" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[80%] p-3 rounded-lg ${message.role === "user"
                  ? "bg-primary/20 text-foreground"
                  : "bg-secondary/50 text-foreground"
                  }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-secondary/50 p-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about me..."
            className="bg-secondary/30 border-border/50"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
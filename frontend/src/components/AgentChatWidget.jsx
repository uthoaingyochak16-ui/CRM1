import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient as useQueryGuest } from "@tanstack/react-query";
import apiGuest from "../api/guest";
import { reloadPage } from "../utils/reload.js";
import { useRealtimeRefresh } from "../realtime/RealtimeContext.jsx";

const SERVICE_PRESETS = [
  {
    id: "anthropic", label: "Anthropic", provider: "anthropic", endpoint: "https://api.anthropic.com",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — Fast (Default)" },
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 — Balanced" },
      { id: "claude-opus-4-1-20250805", label: "Claude Opus 4.1 — Quality" },
    ],
  },
  {
    id: "openai", label: "OpenAI", provider: "openai_compatible", endpoint: "https://api.openai.com/v1",
    models: [
      { id: "gpt-5-nano", label: "GPT-5 Nano — Fast (Default)" },
      { id: "gpt-5-mini", label: "GPT-5 Mini — Balanced" },
      { id: "gpt-5.1", label: "GPT-5.1 — Quality" },
    ],
  },
  {
    id: "gemini", label: "Google Gemini", provider: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite — Fast (Default)" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — Balanced" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro — Quality (Preview)" },
    ],
  },
  {
    id: "openrouter", label: "OpenRouter", provider: "openai_compatible", endpoint: "https://openrouter.ai/api/v1",
    models: [
      { id: "openai/gpt-5-nano", label: "GPT-5 Nano — Fast (Default)" },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 — Balanced" },
      { id: "openai/gpt-5.1", label: "GPT-5.1 — Quality" },
    ],
  },
  {
    id: "groq", label: "Groq", provider: "openai_compatible", endpoint: "https://api.groq.com/openai/v1",
    models: [
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B — Fast (Default)" },
      { id: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B — Balanced" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B — Quality" },
    ],
  },
  {
    id: "deepseek", label: "DeepSeek", provider: "openai_compatible", endpoint: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat — Fast (Default)" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner — Quality" },
    ],
  },
  {
    id: "mistral", label: "Mistral", provider: "openai_compatible", endpoint: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-small-latest", label: "Mistral Small — Fast (Default)" },
      { id: "mistral-medium-latest", label: "Mistral Medium — Balanced" },
      { id: "mistral-large-latest", label: "Mistral Large — Quality" },
    ],
  },
  {
    id: "together", label: "Together AI", provider: "openai_compatible", endpoint: "https://api.together.xyz/v1",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo (Default)" },
      { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek R1 — Reasoning" },
    ],
  },
  {
    id: "ollama", label: "Ollama (Local)", provider: "openai_compatible", endpoint: "http://localhost:11434/v1",
    models: [
      { id: "llama3.2", label: "Llama 3.2 (Default)" },
      { id: "qwen3", label: "Qwen 3" },
      { id: "gemma3", label: "Gemma 3" },
    ],
  },
  { id: "custom", label: "Custom API", provider: "openai_compatible", endpoint: "", models: [] },
];

export default function AgentChatWidget({ currentUser }) {
  const queryGuest = useQueryGuest();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    service: "anthropic",
    provider: "anthropic",
    endpoint: "https://api.anthropic.com",
    model: "claude-haiku-4-5-20251001",
    api_key: "",
  });

  const configQuery = useQuery({
    queryKey: ["agent-config", currentUser?.id],
    queryFn: () => apiGuest.get("/api/agent/config").then((response) => response.data),
    enabled: Boolean(currentUser?.id),
    staleTime: 0,
    retry: (failureCount, error) => error.response?.status !== 401 && failureCount < 2,
    refetchInterval: (query) => query.state.error?.response?.status === 401 ? false : 10_000,
    refetchOnWindowFocus: "always",
  });

  const canUseWidget = Boolean(configQuery.data?.can_use_widget);

  useRealtimeRefresh(["users", "app_settings"], () => {
    configQuery.refetch();
  });

  useEffect(() => {
    if (!canUseWidget) {
      setIsOpen(false);
      setShowSettings(false);
    }
  }, [canUseWidget]);

  useEffect(() => {
    if (configQuery.error?.response?.status === 401) {
      setIsOpen(false);
    }
  }, [configQuery.error]);

  useEffect(() => {
    const config = configQuery.data;
    if (!config) return;
    const preset = SERVICE_PRESETS.find(
      (item) => item.provider === config.provider && item.endpoint === config.endpoint,
    );
    const selectedPreset = preset || SERVICE_PRESETS.find((item) => item.id === "custom");
    setUseCustomModel(!selectedPreset.models.some((model) => model.id === config.model));
    setSettingsForm({
      service: preset?.id || "custom",
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
      api_key: "",
    });
  }, [configQuery.data]);

  const chatMutation = useMutation({
    mutationFn: (message) => apiGuest.post("/api/agent/chat", { message }),
    onSuccess: (res) => {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", text: res.data.response || "কোনো উত্তর পাওয়া যায়নি।" },
      ]);
    },
    onError: (error) => {
      const message =
        error.response?.data?.detail ||
        "AI assistant-এর সঙ্গে সংযোগ করা যাচ্ছে না। আবার চেষ্টা করুন।";
      setMessages((previous) => [...previous, { role: "error", text: message }]);
    },
  });

  const configMutation = useMutation({
    mutationFn: (payload) => apiGuest.put("/api/agent/config", payload),
    onSuccess: (response) => {
      queryGuest.setQueryData(["agent-config", currentUser?.id], response.data);
      setSettingsForm((current) => ({ ...current, api_key: "" }));
      setShowSettings(false);
      reloadPage();
    },
  });

  const handleSend = (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || chatMutation.isPending) return;

    setMessages((previous) => [...previous, { role: "user", text: message }]);
    chatMutation.mutate(message);
    setInput("");
  };

  const handleServiceChange = (serviceId) => {
    const preset = SERVICE_PRESETS.find((item) => item.id === serviceId);
    if (!preset) return;
    setSettingsForm((current) => ({
      ...current,
      service: preset.id,
      provider: preset.provider,
      endpoint: preset.endpoint,
      model: preset.models[0]?.id || "",
    }));
    setUseCustomModel(preset.id === "custom");
  };

  const handleSettingsSave = (event) => {
    event.preventDefault();
    configMutation.mutate({
      provider: settingsForm.provider,
      endpoint: settingsForm.endpoint.trim(),
      model: settingsForm.model.trim(),
      api_key: settingsForm.api_key.trim(),
    });
  };

  if (configQuery.isLoading) {
    return null;
  }

  if (!canUseWidget) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#2554C7] text-white shadow-lg transition hover:bg-[#1D45A6] hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-[#2554C7]/20"
        aria-label="Open AI assistant"
        title="AI Assistant"
      >
        <i className="ti ti-sparkles text-2xl" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex h-[min(34rem,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-[#2554C7] px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <i className="ti ti-sparkles text-lg" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-bold">Quantum AI</div>
            <div className="text-[11px] text-white/75">আপনার কাজের assistant</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {configQuery.data?.can_manage && (
            <button
              type="button"
              onClick={() => setShowSettings((current) => !current)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white ${showSettings ? "bg-white/15 text-white" : ""}`}
              aria-label="AI settings"
              title="AI provider settings"
            >
              <i className="ti ti-settings text-lg" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
            aria-label="Close AI assistant"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showSettings ? (
        <form onSubmit={handleSettingsSave} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#F8FAFC] p-4">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">AI provider configuration</h3>
              <p className="mt-1 text-xs leading-5 text-[#667085]">
                API key server-এ সংরক্ষিত হবে এবং browser-এ ফেরত পাঠানো হবে না।
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#344054]">Provider / Service</span>
              <select
                value={settingsForm.service}
                onChange={(event) => handleServiceChange(event.target.value)}
                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
              >
                {SERVICE_PRESETS.map((service) => (
                  <option key={service.id} value={service.id}>{service.label}</option>
                ))}
              </select>
            </label>

            {settingsForm.service === "custom" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#344054]">API protocol</span>
                <select
                  value={settingsForm.provider}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, provider: event.target.value }))}
                  className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7]"
                >
                  <option value="openai_compatible">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic Messages API</option>
                  <option value="gemini">Google Gemini API</option>
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#344054]">Model ID</span>
              {!useCustomModel && settingsForm.service !== "custom" ? (
                <select
                  value={settingsForm.model}
                  onChange={(event) => {
                    if (event.target.value === "__custom__") {
                      setUseCustomModel(true);
                      setSettingsForm((current) => ({ ...current, model: "" }));
                    } else {
                      setSettingsForm((current) => ({ ...current, model: event.target.value }));
                    }
                  }}
                  className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
                >
                  {(SERVICE_PRESETS.find((item) => item.id === settingsForm.service)?.models || []).map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                  <option value="__custom__">Custom model ID…</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={settingsForm.model}
                    onChange={(event) => setSettingsForm((current) => ({ ...current, model: event.target.value }))}
                    placeholder="যেমন: provider/model-name"
                    className="min-w-0 flex-1 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
                  />
                  {settingsForm.service !== "custom" && (
                    <button
                      type="button"
                      onClick={() => {
                        const preset = SERVICE_PRESETS.find((item) => item.id === settingsForm.service);
                        setUseCustomModel(false);
                        setSettingsForm((current) => ({ ...current, model: preset?.models[0]?.id || "" }));
                      }}
                      className="rounded-xl border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-white"
                    >
                      Presets
                    </button>
                  )}
                </div>
              )}
              <span className="mt-1 block text-[11px] text-[#667085]">
                Fast model কম latency দেয়; quality model জটিল কাজে ভালো। প্রথম option-টি default।
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#344054]">API endpoint</span>
              <input
                type="url"
                required
                value={settingsForm.endpoint}
                onChange={(event) => setSettingsForm((current) => ({ ...current, endpoint: event.target.value }))}
                placeholder="https://provider.example.com/v1"
                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#344054]">API key</span>
              <input
                type="password"
                value={settingsForm.api_key}
                onChange={(event) => setSettingsForm((current) => ({ ...current, api_key: event.target.value }))}
                placeholder={configQuery.data?.has_api_key ? "•••••••• (set—খালি রাখলে অপরিবর্তিত)" : "API key লিখুন"}
                className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
              />
              {settingsForm.service === "ollama" && (
                <span className="mt-1 block text-[11px] text-[#667085]">Local Ollama-এর জন্য API key খালি রাখা যায়।</span>
              )}
            </label>

            {configMutation.isError && (
              <div className="rounded-xl border border-[#FECDCA] bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
                {configMutation.error?.response?.data?.detail || "Configuration save করা যায়নি।"}
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-[#E4E7EC] bg-white p-3">
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="flex-1 rounded-xl border border-[#D0D5DD] px-3 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={configMutation.isPending}
              className="flex-1 rounded-xl bg-[#2554C7] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1D45A6] disabled:opacity-50"
            >
              {configMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] p-4">
        {messages.length === 0 && (
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center">
            <div className="mb-2 text-2xl text-[#2554C7]">
              <i className="ti ti-message-chatbot" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-[#101828]">কীভাবে সাহায্য করতে পারি?</p>
            <p className="mt-1 text-xs leading-5 text-[#667085]">
              কাজ, রিপোর্ট বা Guest follow-up সম্পর্কে প্রশ্ন করুন।
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                message.role === "user"
                  ? "rounded-br-md bg-[#2554C7] text-white"
                  : message.role === "error"
                    ? "rounded-bl-md border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]"
                    : "rounded-bl-md border border-[#E4E7EC] bg-white text-[#344054]"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm text-[#667085]">
              উত্তর তৈরি হচ্ছে…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-[#E4E7EC] bg-white p-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              handleSend(event);
            }
          }}
          rows={1}
          placeholder="আপনার প্রশ্ন লিখুন…"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#2554C7] focus:ring-2 focus:ring-[#2554C7]/10"
          aria-label="Message for AI assistant"
        />
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#2554C7] text-white hover:bg-[#1D45A6] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <i className="ti ti-send text-lg" aria-hidden="true" />
        </button>
      </form>
        </>
      )}
    </div>
  );
}

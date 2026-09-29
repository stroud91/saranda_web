"""The Claude tool loop, driven by a scripted fake client."""
from types import SimpleNamespace as NS

import anthropic


class FakeMessages:
    def __init__(self, script):
        self.script, self.calls = list(script), []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.script.pop(0)


def install(monkeypatch, script):
    messages = FakeMessages(script)
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: NS(beta=NS(messages=messages)))
    return messages


def ask(client, text):
    return client.post("/api/concierge/", json={"messages": [{"role": "user", "content": text}]}).json


def test_tool_loop_runs_tools_and_returns_cards(app, client, monkeypatch):
    app.config["ANTHROPIC_API_KEY"] = "test"
    tool_use = NS(type="tool_use", id="tu_1", name="connect_places", input={"from_slug": "tirana", "to_slug": "ksamil"})
    msgs = install(monkeypatch, [
        NS(stop_reason="tool_use", content=[NS(type="text", text="Checking."), tool_use]),
        NS(stop_reason="end_turn", content=[NS(type="text", text="About **4.5–6 hours**.")]),
    ])
    out = ask(client, "Tirana to Ksamil?")
    assert out["engine"] == "claude" and "4.5" in out["text"]
    assert out["cards"] == [{"type": "route", "from": "tirana", "to": "ksamil"}]
    first, second = msgs.calls
    assert first["model"] == "claude-opus-5-5" and first["output_config"] == {"effort": "low"}
    assert first["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in first["betas"]
    # Append-only history: assistant turn (with tool_use) then the tool_result turn.
    assert second["messages"][1]["role"] == "assistant"
    result = second["messages"][2]["content"][0]
    assert result["type"] == "tool_result" and result["tool_use_id"] == "tu_1" and "hops" in result["content"]


def test_tool_errors_are_returned_to_model(app, client, monkeypatch):
    app.config["ANTHROPIC_API_KEY"] = "test"
    bad = NS(type="tool_use", id="tu_x", name="get_destination", input={"slug": "atlantis"})
    msgs = install(monkeypatch, [
        NS(stop_reason="tool_use", content=[bad]),
        NS(stop_reason="end_turn", content=[NS(type="text", text="I couldn't find that place.")]),
    ])
    ask(client, "Tell me about Atlantis")
    assert msgs.calls[1]["messages"][-1]["content"][0]["is_error"] is True


def test_refusal_is_handled(app, client, monkeypatch):
    app.config["ANTHROPIC_API_KEY"] = "test"
    install(monkeypatch, [NS(stop_reason="refusal", content=[])])
    assert "can't help" in ask(client, "something off-topic")["text"]


def test_api_failure_falls_back_to_offline(app, client, monkeypatch):
    app.config["ANTHROPIC_API_KEY"] = "test"

    def broken(**kw):
        raise anthropic.APIConnectionError(request=None)
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: NS(beta=NS(messages=NS(create=broken))))
    out = ask(client, "emergency numbers")
    assert out["engine"] == "offline" and "112" in out["text"]

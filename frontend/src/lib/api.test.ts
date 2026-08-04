import { describe, it, expect, vi, afterEach } from "vitest"
import { request, rawFetch, ApiException } from "./api"

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

describe("request", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("success_returnsJsonBody", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { id: "abc" }))
    await expect(request("/path")).resolves.toEqual({ id: "abc" })
  })

  it("204_returnsUndefined", async () => {
    vi.stubGlobal("fetch", mockFetch(204, null))
    await expect(request("/path")).resolves.toBeUndefined()
  })

  it("errorEnvelope_throwsApiExceptionWithParsedCodeAndMessage", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { error: { code: "invalid_input", message: "Bad input" } }, false))
    const err = await request("/path").catch(e => e)
    expect(err).toBeInstanceOf(ApiException)
    expect(err.status).toBe(400)
    expect(err.code).toBe("invalid_input")
    expect(err.message).toBe("Bad input")
  })

  it("nonJsonErrorBody_throwsApiExceptionWithDefaultCode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError("non-JSON body")),
    }))
    const err = await request("/path").catch(e => e)
    expect(err).toBeInstanceOf(ApiException)
    expect(err.status).toBe(500)
    expect(err.code).toBe("unknown_error")
  })

  it("withToken_setsBearerAuthorizationHeader", async () => {
    const fetchMock = mockFetch(200, {})
    vi.stubGlobal("fetch", fetchMock)
    await request("/path", {}, "my-access-token")
    const [, opts] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(opts.headers["Authorization"]).toBe("Bearer my-access-token")
  })

  it("withoutToken_omitsAuthorizationHeader", async () => {
    const fetchMock = mockFetch(200, {})
    vi.stubGlobal("fetch", fetchMock)
    await request("/path")
    const [, opts] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(opts.headers["Authorization"]).toBeUndefined()
  })

  it("apiExceptionName_isApiException", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { error: { code: "unauthorized", message: "Unauthorized" } }, false))
    const err = await request("/path").catch(e => e)
    expect(err.name).toBe("ApiException")
  })
})

describe("rawFetch", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("success_returnsRawResponse", async () => {
    const response = { ok: true, status: 200, json: vi.fn() }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))
    await expect(rawFetch("/path")).resolves.toBe(response)
  })

  it("errorResponse_throwsApiExceptionWithParsedFields", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { error: { code: "forbidden", message: "Forbidden" } }, false))
    const err = await rawFetch("/path").catch(e => e)
    expect(err).toBeInstanceOf(ApiException)
    expect(err.status).toBe(403)
    expect(err.code).toBe("forbidden")
  })

  it("withToken_setsBearerAuthorizationHeader", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn() })
    vi.stubGlobal("fetch", fetchMock)
    await rawFetch("/path", {}, "raw-token")
    const [, opts] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(opts.headers["Authorization"]).toBe("Bearer raw-token")
  })
})

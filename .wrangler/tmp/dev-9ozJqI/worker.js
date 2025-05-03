var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-5Vbkpb/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/worker.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
var rateLimit = {
  requests: /* @__PURE__ */ new Map(),
  limit: 100,
  // requests per minute
  interval: 60 * 1e3,
  // 1 minute in milliseconds
  checkLimit(ip) {
    const now = Date.now();
    const requests = this.requests.get(ip) || [];
    const recentRequests = requests.filter((time) => now - time < this.interval);
    if (recentRequests.length >= this.limit) {
      return false;
    }
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);
    return true;
  }
};
var worker_default = {
  async fetch(request, env) {
    const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    if (!rateLimit.checkLimit(clientIP)) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path.startsWith("/api/")) {
        if (path === "/api/properties") {
          if (request.method === "POST") {
            let data;
            try {
              data = await request.json();
            } catch (e) {
              return jsonResponse({ error: "Invalid JSON payload" }, 400);
            }
            const required = ["name", "email", "phone", "propertyType", "address", "area", "price", "listingType"];
            for (const field of required) {
              if (!data[field]) {
                return jsonResponse({ error: `${field} is required` }, 400);
              }
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
              return jsonResponse({ error: "Invalid email format" }, 400);
            }
            if (isNaN(data.area) || data.area <= 0) {
              return jsonResponse({ error: "Invalid area value" }, 400);
            }
            if (isNaN(data.price) || data.price <= 0) {
              return jsonResponse({ error: "Invalid price value" }, 400);
            }
            try {
              console.log("Attempting to save property:", data);
              const stmt = await env.DB.prepare(`
                INSERT INTO properties (
                  name, email, phone, property_type, address,
                  bedrooms, bathrooms, area, price, listing_type,
                  description, status,
                  location, amenities, photos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
              `).bind(
                data.name,
                data.email,
                data.phone,
                data.propertyType,
                data.address,
                data.bedrooms || null,
                data.bathrooms || null,
                data.area,
                data.price,
                data.listingType,
                data.description,
                "pending",
                JSON.stringify(data.location || {}),
                JSON.stringify(data.amenities || []),
                JSON.stringify(data.photos || [])
              );
              console.log("Statement prepared successfully");
              const { results } = await stmt.all();
              console.log("Query executed, results:", results);
              const id = results[0]?.id;
              console.log("Property saved successfully with ID:", id);
              return jsonResponse({ success: true, id });
            } catch (error) {
              console.error("Detailed error saving property:", {
                message: error.message,
                stack: error.stack,
                data
              });
              return jsonResponse({ error: "Failed to save property: " + error.message }, 500);
            }
          }
          if (request.method === "GET") {
            try {
              const isTest = request.headers.get("x-test-env") === "true";
              const query = isTest ? "SELECT * FROM properties ORDER BY created_at DESC" : 'SELECT * FROM properties WHERE status = "approved" ORDER BY created_at DESC';
              const { results } = await env.DB.prepare(query).all();
              const properties = (results || []).map((p) => ({
                id: p.id,
                name: p.name,
                email: p.email,
                phone: p.phone,
                propertyType: p.property_type,
                address: p.address,
                bedrooms: p.bedrooms,
                bathrooms: p.bathrooms,
                area: p.area,
                price: p.price,
                listingType: p.listing_type,
                description: p.description,
                status: p.status,
                createdAt: p.created_at,
                location: p.location ? JSON.parse(p.location) : {},
                amenities: p.amenities ? JSON.parse(p.amenities) : [],
                photos: p.photos ? JSON.parse(p.photos) : []
              }));
              return jsonResponse(properties);
            } catch (error) {
              console.error("Error fetching properties:", error);
              return jsonResponse({ error: "Failed to fetch properties: " + error.message }, 500);
            }
          }
        }
        if (path === "/api/contact" && request.method === "POST") {
          try {
            const data = await request.json();
            console.log("Received contact submission:", data);
            const stmt = await env.DB.prepare(`
              INSERT INTO contact_messages (
                name, email, phone, subject, message, created_at
              ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              data.contactName,
              data.contactEmail,
              data.contactPhone || null,
              data.contactSubject,
              data.contactMessage
            );
            await stmt.run();
            console.log("Contact message saved successfully");
            return jsonResponse({ success: true });
          } catch (error) {
            console.error("Error saving contact message:", error);
            return jsonResponse({ error: "Failed to save message: " + error.message }, 500);
          }
        }
        if (path === "/api/newsletter" && request.method === "POST") {
          try {
            const data = await request.json();
            console.log("Received newsletter subscription:", data);
            if (!data.email) {
              return jsonResponse({ error: "Email is required" }, 400);
            }
            const stmt = await env.DB.prepare(`
              INSERT INTO newsletter_subscriptions (email, created_at)
              VALUES (?, datetime('now'))
            `).bind(data.email);
            await stmt.run();
            console.log("Newsletter subscription saved successfully");
            return jsonResponse({ success: true });
          } catch (error) {
            if (error.message.includes("UNIQUE constraint failed")) {
              return jsonResponse({ error: "Email already subscribed" }, 400);
            }
            console.error("Error saving newsletter subscription:", error);
            return jsonResponse({ error: "Failed to subscribe: " + error.message }, 500);
          }
        }
        return jsonResponse({ error: "Not Found" }, 404);
      }
      return jsonResponse({
        message: "SLICT Property API Server",
        note: "In development mode, please serve the static files separately using a development server.",
        endpoints: {
          "/api/properties": {
            methods: ["GET", "POST"],
            description: "List and create properties"
          },
          "/api/contact": {
            methods: ["POST"],
            description: "Submit contact form"
          },
          "/api/newsletter": {
            methods: ["POST"],
            description: "Subscribe to newsletter"
          }
        }
      });
    } catch (error) {
      console.error("Server error:", error);
      return jsonResponse({ error: "Internal Server Error: " + error.message }, 500);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-5Vbkpb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-5Vbkpb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
var init_dist = __esm({
  "node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    (function(SystemBarsStyle2) {
      SystemBarsStyle2["Dark"] = "DARK";
      SystemBarsStyle2["Light"] = "LIGHT";
      SystemBarsStyle2["Default"] = "DEFAULT";
    })(SystemBarsStyle || (SystemBarsStyle = {}));
    (function(SystemBarType2) {
      SystemBarType2["StatusBar"] = "StatusBar";
      SystemBarType2["NavigationBar"] = "NavigationBar";
    })(SystemBarType || (SystemBarType = {}));
    SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-element.js
var NATIVE_AD_ELEMENT_NAME, defineNativeAdElement, connectNativeAdElements;
var init_native_ad_element = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-element.js"() {
    NATIVE_AD_ELEMENT_NAME = "capacitor-admob-native";
    defineNativeAdElement = (findFeed) => {
      const runtime = globalThis;
      runtime.__capacitorAdMobNativeFeedLookup = findFeed;
      if (typeof customElements === "undefined" || customElements.get(NATIVE_AD_ELEMENT_NAME)) {
        return;
      }
      customElements.define(NATIVE_AD_ELEMENT_NAME, class extends HTMLElement {
        static get observedAttributes() {
          return ["feed-id", "slot-key"];
        }
        connectedCallback() {
          this.connectToFeed();
        }
        disconnectedCallback() {
          this.disconnectFromFeed();
        }
        attributeChangedCallback() {
          if (!this.isConnected) {
            return;
          }
          this.disconnectFromFeed();
          this.connectToFeed();
        }
        connectToFeed() {
          var _a, _b, _c;
          const feedId = (_a = this.getAttribute("feed-id")) === null || _a === void 0 ? void 0 : _a.trim();
          const slotKey = (_b = this.getAttribute("slot-key")) === null || _b === void 0 ? void 0 : _b.trim();
          const feed = feedId ? (_c = runtime.__capacitorAdMobNativeFeedLookup) === null || _c === void 0 ? void 0 : _c.call(runtime, feedId) : void 0;
          if (!feed || !slotKey) {
            return;
          }
          try {
            feed.attach(slotKey, this);
            this.attachedFeed = feed;
          } catch (error) {
            this.dispatchEvent(new CustomEvent("nativeAdError", { bubbles: true, detail: error }));
          }
        }
        disconnectFromFeed() {
          var _a;
          (_a = this.attachedFeed) === null || _a === void 0 ? void 0 : _a.detach(this);
          this.attachedFeed = void 0;
        }
      });
    };
    connectNativeAdElements = () => {
      document.querySelectorAll(NATIVE_AD_ELEMENT_NAME).forEach((element) => {
        var _a, _b;
        return (_b = (_a = element).connectToFeed) === null || _b === void 0 ? void 0 : _b.call(_a);
      });
    };
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-geometry.js
function* nativeAdAncestors(element) {
  var _a, _b;
  let current = element;
  while (current) {
    const root = current.getRootNode();
    current = (_b = (_a = current.assignedSlot) !== null && _a !== void 0 ? _a : current.parentElement) !== null && _b !== void 0 ? _b : root instanceof ShadowRoot ? root.host : null;
    if (current)
      yield current;
  }
}
var intersectRects, toNativeRect, clipsDescendants, measureNativeAdSlot, measureNativeAdScrollContainer;
var init_native_ad_geometry = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-geometry.js"() {
    intersectRects = (left, right) => {
      const x = Math.max(left.x, right.x);
      const y = Math.max(left.y, right.y);
      const maxX = Math.min(left.x + left.width, right.x + right.width);
      const maxY = Math.min(left.y + left.height, right.y + right.height);
      return {
        x,
        y,
        width: Math.max(0, maxX - x),
        height: Math.max(0, maxY - y)
      };
    };
    toNativeRect = (rect) => ({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    });
    clipsDescendants = (element) => {
      const style = window.getComputedStyle(element);
      return [style.overflow, style.overflowX, style.overflowY].some((value) => ["auto", "hidden", "scroll", "clip"].includes(value));
    };
    measureNativeAdSlot = (element, scrollElement) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const style = window.getComputedStyle(element);
      const domRect = element.getBoundingClientRect();
      if (!element.isConnected || style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") === 0 || domRect.width <= 0 || domRect.height <= 0) {
        return void 0;
      }
      const rect = toNativeRect(domRect);
      let clipRect = scrollElement ? rect : {
        x: (_b = (_a = window.visualViewport) === null || _a === void 0 ? void 0 : _a.offsetLeft) !== null && _b !== void 0 ? _b : 0,
        y: (_d = (_c = window.visualViewport) === null || _c === void 0 ? void 0 : _c.offsetTop) !== null && _d !== void 0 ? _d : 0,
        width: (_f = (_e = window.visualViewport) === null || _e === void 0 ? void 0 : _e.width) !== null && _f !== void 0 ? _f : window.innerWidth,
        height: (_h = (_g = window.visualViewport) === null || _g === void 0 ? void 0 : _g.height) !== null && _h !== void 0 ? _h : window.innerHeight
      };
      let foundScrollElement = !scrollElement;
      for (const ancestor of nativeAdAncestors(element)) {
        if (ancestor === scrollElement) {
          foundScrollElement = true;
          break;
        }
        if (clipsDescendants(ancestor)) {
          clipRect = intersectRects(clipRect, toNativeRect(ancestor.getBoundingClientRect()));
        }
      }
      clipRect = intersectRects(rect, clipRect);
      if (!foundScrollElement || clipRect.width <= 0 || clipRect.height <= 0)
        return void 0;
      if (scrollElement) {
        const origin = scrollElement.getBoundingClientRect();
        const translate = (value) => Object.assign(Object.assign({}, value), { x: value.x - origin.left + scrollElement.scrollLeft, y: value.y - origin.top + scrollElement.scrollTop });
        return { rect: translate(rect), clipRect: translate(clipRect) };
      }
      return { rect, clipRect };
    };
    measureNativeAdScrollContainer = (element) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      const rect = toNativeRect(element.getBoundingClientRect());
      let clipRect = intersectRects(rect, {
        x: (_b = (_a = window.visualViewport) === null || _a === void 0 ? void 0 : _a.offsetLeft) !== null && _b !== void 0 ? _b : 0,
        y: (_d = (_c = window.visualViewport) === null || _c === void 0 ? void 0 : _c.offsetTop) !== null && _d !== void 0 ? _d : 0,
        width: (_f = (_e = window.visualViewport) === null || _e === void 0 ? void 0 : _e.width) !== null && _f !== void 0 ? _f : window.innerWidth,
        height: (_h = (_g = window.visualViewport) === null || _g === void 0 ? void 0 : _g.height) !== null && _h !== void 0 ? _h : window.innerHeight
      });
      for (const ancestor of nativeAdAncestors(element)) {
        if (clipsDescendants(ancestor)) {
          clipRect = intersectRects(clipRect, toNativeRect(ancestor.getBoundingClientRect()));
        }
      }
      return { rect, clipRect, contentWidth: element.scrollWidth, contentHeight: element.scrollHeight };
    };
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-template.enum.js
var NativeAdTemplate;
var init_native_ad_template_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-template.enum.js"() {
    (function(NativeAdTemplate2) {
      NativeAdTemplate2["Small"] = "small";
      NativeAdTemplate2["Medium"] = "medium";
    })(NativeAdTemplate || (NativeAdTemplate = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-feed.js
var SCROLL_SETTLE_MS, MAX_NATIVE_ADS, MAX_ACTIVE_FEEDS, MIN_SMALL_SLOT_WIDTH, MIN_MEDIUM_SLOT_WIDTH, MIN_MEDIUM_SLOT_HEIGHT, MIN_SMALL_SLOT_HEIGHT, TEMPLATE_ATTRIBUTE, applySlotDefaults, bridge, sessionSequence, feeds, createSessionId, NativeAdFeed, configureNativeAdBridge;
var init_native_ad_feed = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-feed.js"() {
    init_dist();
    init_native_ad_element();
    init_native_ad_geometry();
    init_native_ad_template_enum();
    SCROLL_SETTLE_MS = 120;
    MAX_NATIVE_ADS = 3;
    MAX_ACTIVE_FEEDS = 2;
    MIN_SMALL_SLOT_WIDTH = 120;
    MIN_MEDIUM_SLOT_WIDTH = 144;
    MIN_MEDIUM_SLOT_HEIGHT = 300;
    MIN_SMALL_SLOT_HEIGHT = 120;
    TEMPLATE_ATTRIBUTE = "data-capacitor-admob-template";
    applySlotDefaults = (element, template) => {
      const root = element.getRootNode();
      const container = root instanceof ShadowRoot ? root : element.ownerDocument.head;
      if (!container.querySelector("style[data-capacitor-admob-defaults]")) {
        const style = element.ownerDocument.createElement("style");
        style.setAttribute("data-capacitor-admob-defaults", "");
        const defaults = `
      :where([${TEMPLATE_ATTRIBUTE}]) { display: block; height: 320px; }
      :where([${TEMPLATE_ATTRIBUTE}="small"]) { height: 120px; }
    `;
        style.textContent = "CSSLayerBlockRule" in globalThis ? `@layer capacitor-admob-defaults { ${defaults} }` : defaults;
        container.prepend(style);
      }
      element.setAttribute(TEMPLATE_ATTRIBUTE, template);
    };
    sessionSequence = 0;
    feeds = /* @__PURE__ */ new Map();
    createSessionId = () => {
      var _a, _b, _c;
      return (_c = (_b = (_a = globalThis.crypto) === null || _a === void 0 ? void 0 : _a.randomUUID) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : `${Date.now()}-${++sessionSequence}-${Math.random().toString(36).slice(2)}`;
    };
    NativeAdFeed = class _NativeAdFeed {
      constructor(options) {
        var _a;
        this.sessionId = createSessionId();
        this.slots = /* @__PURE__ */ new Map();
        this.elementSlots = /* @__PURE__ */ new Map();
        this.scrollRoots = /* @__PURE__ */ new Set();
        this.destroyed = false;
        this.nativeStarted = false;
        this.paused = false;
        this.layoutInvalidated = false;
        this.lastPlacementWasDirect = false;
        this.placementAcknowledgementRequired = false;
        this.operationTask = Promise.resolve();
        this.updateDirty = false;
        this.placementSequence = 0;
        this.listenerHandles = /* @__PURE__ */ new Set();
        this.handleViewportMotion = (event) => {
          if (this.destroyed) {
            return;
          }
          if (!(this.nativeScrollElement && event instanceof Event && ["scroll", "touchmove", "wheel"].includes(event.type))) {
            this.schedulePlacementUpdate();
          }
          this.scheduleEvaluation();
        };
        this.handleVisibilityChange = () => {
          if (this.destroyed) {
            return;
          }
          if (document.hidden) {
            this.layoutInvalidated = true;
            void this.requestPlacementUpdate();
            return;
          }
          this.scheduleEvaluation();
        };
        const id = options.feedId.trim();
        if (!id) {
          throw new Error("Native ad feed id must not be empty");
        }
        if (feeds.has(id)) {
          throw new Error(`Native ad feed id already exists: ${id}`);
        }
        if (feeds.size >= MAX_ACTIVE_FEEDS) {
          throw new Error(`At most ${MAX_ACTIVE_FEEDS} native ad feeds can be active`);
        }
        this.options = Object.assign(Object.assign({}, options), { feedId: id });
        this.nativeScrollElement = Capacitor.getPlatform() === "ios" ? options.scrollElement : void 0;
        if (typeof IntersectionObserver !== "undefined") {
          this.intersectionObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              const slotKey = this.elementSlots.get(entry.target);
              const state = slotKey ? this.slots.get(slotKey) : void 0;
              if (state) {
                state.intersecting = entry.isIntersecting;
              }
            }
            this.schedulePlacementUpdate();
            this.scheduleEvaluation();
          });
        }
        if (typeof ResizeObserver !== "undefined") {
          this.resizeObserver = new ResizeObserver(this.handleViewportMotion);
          if (this.nativeScrollElement)
            this.resizeObserver.observe(this.nativeScrollElement);
        }
        document.addEventListener("scroll", this.handleViewportMotion, true);
        document.addEventListener("touchmove", this.handleViewportMotion, { capture: true, passive: true });
        document.addEventListener("wheel", this.handleViewportMotion, { capture: true, passive: true });
        window.addEventListener("resize", this.handleViewportMotion, { passive: true });
        (_a = window.visualViewport) === null || _a === void 0 ? void 0 : _a.addEventListener("resize", this.handleViewportMotion, { passive: true });
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        document.addEventListener("load", this.handleViewportMotion, true);
        feeds.set(id, this);
      }
      static async create(options) {
        var _a;
        if (!bridge) {
          throw new Error("AdMob native ad bridge is not configured");
        }
        if (typeof document === "undefined" || typeof window === "undefined") {
          throw new Error("NativeAdFeed can only be created in a browser environment");
        }
        if (options.isTesting !== true && !((_a = options.adId) === null || _a === void 0 ? void 0 : _a.trim())) {
          throw new Error("adId is required unless isTesting is true");
        }
        const feed = new _NativeAdFeed(options);
        try {
          await bridge.startNativeAdFeed({ feedId: feed.feedId, sessionId: feed.sessionId });
          feed.nativeStarted = true;
          defineNativeAdElement((feedId) => feeds.get(feedId));
          connectNativeAdElements();
          return feed;
        } catch (error) {
          await feed.destroy();
          throw error;
        }
      }
      get feedId() {
        return this.options.feedId;
      }
      async addListener(eventName, listener) {
        this.assertActive();
        if (!bridge) {
          throw new Error("AdMob native ad bridge is not configured");
        }
        const nativeHandle = await bridge.addListener(eventName, (event) => {
          if (event.feedId === this.options.feedId && event.sessionId === this.sessionId) {
            const filteredListener = listener;
            filteredListener(event);
          }
        });
        if (this.destroyed) {
          await nativeHandle.remove();
          this.assertActive();
        }
        let removed = false;
        const handle = {
          remove: async () => {
            if (removed) {
              return;
            }
            removed = true;
            this.listenerHandles.delete(handle);
            await nativeHandle.remove();
          }
        };
        this.listenerHandles.add(handle);
        return handle;
      }
      attach(slotKey, element) {
        var _a, _b, _c;
        this.assertActive();
        const normalizedKey = slotKey.trim();
        if (!normalizedKey) {
          throw new Error("Native ad slotKey must not be empty");
        }
        const previousKey = this.elementSlots.get(element);
        if (previousKey === normalizedKey) {
          return;
        }
        if (previousKey && previousKey !== normalizedKey) {
          this.detach(element);
        }
        const existing = this.slots.get(normalizedKey);
        if ((existing === null || existing === void 0 ? void 0 : existing.element) && existing.element !== element) {
          throw new Error(`Native ad slotKey is already attached: ${normalizedKey}`);
        }
        const state = existing !== null && existing !== void 0 ? existing : {
          slotKey: normalizedKey,
          generation: 0,
          intersecting: !this.intersectionObserver,
          status: "idle",
          lastUsed: Date.now(),
          loadVersion: 0
        };
        applySlotDefaults(element, (_a = this.options.template) !== null && _a !== void 0 ? _a : NativeAdTemplate.Medium);
        state.element = element;
        state.generation += 1;
        state.lastUsed = Date.now();
        this.slots.set(normalizedKey, state);
        this.elementSlots.set(element, normalizedKey);
        this.updateScrollRoots();
        (_b = this.intersectionObserver) === null || _b === void 0 ? void 0 : _b.observe(element);
        (_c = this.resizeObserver) === null || _c === void 0 ? void 0 : _c.observe(element);
        this.scheduleEvaluation();
      }
      detach(element) {
        var _a, _b;
        const slotKey = this.elementSlots.get(element);
        if (!slotKey) {
          return;
        }
        const state = this.slots.get(slotKey);
        if ((state === null || state === void 0 ? void 0 : state.element) === element) {
          state.element = void 0;
          state.intersecting = false;
          state.generation += 1;
          state.lastUsed = Date.now();
        }
        (_a = this.intersectionObserver) === null || _a === void 0 ? void 0 : _a.unobserve(element);
        (_b = this.resizeObserver) === null || _b === void 0 ? void 0 : _b.unobserve(element);
        this.elementSlots.delete(element);
        this.updateScrollRoots();
        void this.requestPlacementUpdate();
        this.scheduleEvaluation();
      }
      async reload(slotKey) {
        this.assertActive();
        const normalizedKey = slotKey.trim();
        const state = this.slots.get(normalizedKey);
        if (!state) {
          throw new Error(`Native ad slotKey is not registered: ${normalizedKey}`);
        }
        await this.runOperation(async () => {
          await this.removeStateAd(state);
          const protectedStates = new Set(this.getVisibleStates());
          protectedStates.add(state);
          await this.evictUnusedAds(protectedStates);
          if ([...this.slots.values()].filter((slot) => this.occupiesNativeAd(slot)).length >= MAX_NATIVE_ADS) {
            throw new Error("Native ad capacity is currently in use by visible slots");
          }
          await this.loadState(state);
        });
      }
      /** Immediately hides this feed's overlays until {@link resume} is called. */
      async pause() {
        this.assertActive();
        this.paused = true;
        this.layoutInvalidated = true;
        if (!await this.requestPlacementUpdate()) {
          throw new Error("Failed to hide native ad placements");
        }
      }
      /** Re-evaluates slots and restores eligible overlays after the viewport settles. */
      resume() {
        this.assertActive();
        this.paused = false;
        this.scheduleEvaluation();
      }
      /** Hides stale overlays and remeasures after an application-driven layout change. */
      async invalidateLayout() {
        this.assertActive();
        this.layoutInvalidated = true;
        this.scheduleEvaluation();
        if (!await this.requestPlacementUpdate()) {
          throw new Error("Failed to hide native ad placements");
        }
      }
      async destroy() {
        var _a, _b, _c;
        if (!this.destroyed) {
          this.destroyed = true;
          feeds.delete(this.options.feedId);
          document.removeEventListener("scroll", this.handleViewportMotion, true);
          for (const root of this.scrollRoots) {
            root.removeEventListener("scroll", this.handleViewportMotion, true);
          }
          this.scrollRoots.clear();
          document.removeEventListener("touchmove", this.handleViewportMotion, true);
          document.removeEventListener("wheel", this.handleViewportMotion, true);
          window.removeEventListener("resize", this.handleViewportMotion);
          (_a = window.visualViewport) === null || _a === void 0 ? void 0 : _a.removeEventListener("resize", this.handleViewportMotion);
          document.removeEventListener("visibilitychange", this.handleVisibilityChange);
          document.removeEventListener("load", this.handleViewportMotion, true);
          if (this.settleTimer) {
            clearTimeout(this.settleTimer);
          }
          if (this.placementFrame !== void 0) {
            cancelAnimationFrame(this.placementFrame);
            this.placementFrame = void 0;
          }
          (_b = this.intersectionObserver) === null || _b === void 0 ? void 0 : _b.disconnect();
          (_c = this.resizeObserver) === null || _c === void 0 ? void 0 : _c.disconnect();
        }
        if (this.destroyTask) {
          return this.destroyTask;
        }
        this.destroyTask = this.destroyResources();
        try {
          await this.destroyTask;
        } finally {
          this.destroyTask = void 0;
        }
      }
      schedulePlacementUpdate() {
        if (this.destroyed || this.placementFrame !== void 0) {
          return;
        }
        this.placementFrame = requestAnimationFrame(() => {
          this.placementFrame = void 0;
          void this.requestPlacementUpdate(true);
        });
      }
      updateScrollRoots() {
        const roots = /* @__PURE__ */ new Set();
        for (const element of this.elementSlots.keys()) {
          for (const ancestor of [element, ...nativeAdAncestors(element)]) {
            const root = ancestor.getRootNode();
            if (root instanceof ShadowRoot)
              roots.add(root);
          }
        }
        for (const root of this.scrollRoots) {
          if (!roots.has(root)) {
            root.removeEventListener("scroll", this.handleViewportMotion, true);
            this.scrollRoots.delete(root);
          }
        }
        for (const root of roots) {
          if (!this.scrollRoots.has(root)) {
            root.addEventListener("scroll", this.handleViewportMotion, true);
            this.scrollRoots.add(root);
          }
        }
      }
      scheduleEvaluation() {
        if (this.destroyed) {
          return;
        }
        if (this.settleTimer) {
          clearTimeout(this.settleTimer);
        }
        this.settleTimer = setTimeout(() => {
          this.layoutInvalidated = false;
          void this.runOperation(() => this.evaluate());
        }, SCROLL_SETTLE_MS);
      }
      async evaluate() {
        if (this.destroyed || this.paused || document.hidden) {
          return;
        }
        const visibleStates = this.getVisibleStates();
        for (const state of visibleStates) {
          state.lastUsed = Date.now();
        }
        await this.evictUnusedAds(new Set(visibleStates));
        const occupied = [...this.slots.values()].filter((state) => this.occupiesNativeAd(state)).length;
        const loadable = visibleStates.filter((state) => state.status === "idle").slice(0, Math.max(0, MAX_NATIVE_ADS - occupied));
        await Promise.allSettled(loadable.map((state) => this.loadState(state)));
        void this.requestPlacementUpdate();
      }
      async loadState(state) {
        var _a;
        if (state.status !== "idle" || !bridge) {
          return;
        }
        state.status = "loading";
        const loadVersion = ++state.loadVersion;
        try {
          await bridge.loadNativeAd({
            feedId: this.options.feedId,
            sessionId: this.sessionId,
            slotKey: state.slotKey,
            template: (_a = this.options.template) !== null && _a !== void 0 ? _a : NativeAdTemplate.Medium,
            style: this.options.style,
            adId: this.options.adId,
            isTesting: this.options.isTesting,
            npa: this.options.npa
          });
          if (state.loadVersion === loadVersion) {
            state.status = "loaded";
            state.lastUsed = Date.now();
          }
        } catch (error) {
          if (state.loadVersion === loadVersion) {
            state.status = "failed";
          }
          throw error;
        }
      }
      async evictUnusedAds(visibleStates) {
        const occupied = [...this.slots.values()].filter((state) => this.occupiesNativeAd(state));
        const requestedLoads = [...visibleStates].filter((state) => state.status === "idle").length;
        const evictionCount = Math.max(0, occupied.length + Math.min(requestedLoads, MAX_NATIVE_ADS) - MAX_NATIVE_ADS);
        const evicted = occupied.filter((state) => !visibleStates.has(state)).sort((left, right) => left.lastUsed - right.lastUsed).slice(0, evictionCount);
        await Promise.allSettled(evicted.map((state) => this.removeStateAd(state)));
        const detached = [...this.slots.values()].filter((state) => !state.element && !this.occupiesNativeAd(state)).sort((left, right) => right.lastUsed - left.lastUsed);
        for (const state of detached.slice(MAX_NATIVE_ADS)) {
          this.slots.delete(state.slotKey);
        }
      }
      occupiesNativeAd(state) {
        return ["loading", "loaded", "removing", "removeFailed"].includes(state.status);
      }
      getVisibleStates() {
        return [...this.slots.values()].filter((state) => {
          const measured = state.element && state.intersecting ? measureNativeAdSlot(state.element) : void 0;
          return Boolean(measured && this.isSupportedSize(measured));
        });
      }
      isSupportedSize(measured) {
        var _a, _b;
        const minimumHeight = ((_a = this.options.template) !== null && _a !== void 0 ? _a : NativeAdTemplate.Medium) === NativeAdTemplate.Small ? MIN_SMALL_SLOT_HEIGHT : MIN_MEDIUM_SLOT_HEIGHT;
        const minimumWidth = ((_b = this.options.template) !== null && _b !== void 0 ? _b : NativeAdTemplate.Medium) === NativeAdTemplate.Small ? MIN_SMALL_SLOT_WIDTH : MIN_MEDIUM_SLOT_WIDTH;
        return measured.rect.width >= minimumWidth && measured.rect.height >= minimumHeight;
      }
      async removeStateAd(state) {
        if (state.status === "removing") {
          return;
        }
        if (!bridge || state.status === "idle" || state.status === "failed") {
          state.status = "idle";
          return;
        }
        state.status = "removing";
        const removeVersion = ++state.loadVersion;
        await this.requestPlacementUpdate();
        try {
          await bridge.removeNativeAd({
            feedId: this.options.feedId,
            sessionId: this.sessionId,
            slotKey: state.slotKey
          });
          if (state.loadVersion === removeVersion) {
            state.status = "idle";
          }
        } catch (error) {
          if (state.loadVersion === removeVersion) {
            state.status = "removeFailed";
          }
          throw error;
        }
      }
      runOperation(operation) {
        const result = this.operationTask.then(operation);
        this.operationTask = result.catch(() => void 0);
        return result;
      }
      async destroyResources() {
        await Promise.all([
          ...[...this.listenerHandles].map((handle) => handle.remove()),
          ...this.nativeStarted && bridge ? [bridge.destroyNativeAdFeed({ feedId: this.options.feedId, sessionId: this.sessionId })] : []
        ]);
        this.nativeStarted = false;
        this.listenerHandles.clear();
        this.slots.clear();
        this.elementSlots.clear();
      }
      requestPlacementUpdate(allowDirect = false) {
        this.updateDirty = true;
        this.placementAcknowledgementRequired || (this.placementAcknowledgementRequired = !allowDirect);
        if (!this.placementUpdateTask) {
          this.placementUpdateTask = Promise.resolve().then(() => this.flushPlacementUpdates());
        }
        return this.placementUpdateTask;
      }
      async flushPlacementUpdates() {
        if (!bridge || this.destroyed) {
          return true;
        }
        try {
          while (this.updateDirty && !this.destroyed) {
            this.updateDirty = false;
            const allowDirect = !this.placementAcknowledgementRequired;
            this.placementAcknowledgementRequired = false;
            const placements = [...this.slots.values()].filter((state) => state.status === "loaded").map((state) => {
              const measured = state.element ? measureNativeAdSlot(state.element, this.nativeScrollElement) : void 0;
              const visible = Boolean(!this.paused && !this.layoutInvalidated && measured && this.isSupportedSize(measured) && !document.hidden);
              return {
                feedId: this.options.feedId,
                slotKey: state.slotKey,
                generation: state.generation,
                visible,
                rect: measured === null || measured === void 0 ? void 0 : measured.rect,
                clipRect: measured === null || measured === void 0 ? void 0 : measured.clipRect
              };
            });
            const scrollContainer = this.nativeScrollElement ? measureNativeAdScrollContainer(this.nativeScrollElement) : void 0;
            const serializedPlacements = JSON.stringify({ placements, scrollContainer });
            if (serializedPlacements === this.lastPlacements && (allowDirect || !this.lastPlacementWasDirect)) {
              continue;
            }
            try {
              const batch = Object.assign({ feedId: this.options.feedId, sessionId: this.sessionId, sequence: ++this.placementSequence, placements }, scrollContainer ? { scrollContainer } : {});
              const channel = Capacitor.getPlatform() === "android" ? window.capacitorAdMobPlacements : void 0;
              let sentDirectly = false;
              if (allowDirect && channel) {
                try {
                  channel.postMessage(JSON.stringify(batch));
                  sentDirectly = true;
                } catch (_a) {
                }
              }
              if (!sentDirectly)
                await bridge.updateNativeAdPlacements(batch);
              this.lastPlacementWasDirect = sentDirectly;
              this.lastPlacements = serializedPlacements;
            } catch (_b) {
              this.lastPlacements = void 0;
              this.updateDirty = true;
              return false;
            }
          }
          return true;
        } catch (_c) {
          this.updateDirty = true;
          return false;
        } finally {
          this.placementUpdateTask = void 0;
        }
      }
      assertActive() {
        if (this.destroyed) {
          throw new Error(`Native ad feed has been destroyed: ${this.options.feedId}`);
        }
      }
    };
    configureNativeAdBridge = (adMobBridge) => {
      bridge = adMobBridge;
    };
  }
});

// node_modules/@capacitor-community/admob/dist/esm/definitions.js
var MaxAdContentRating;
var init_definitions = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/definitions.js"() {
    (function(MaxAdContentRating2) {
      MaxAdContentRating2["General"] = "General";
      MaxAdContentRating2["ParentalGuidance"] = "ParentalGuidance";
      MaxAdContentRating2["Teen"] = "Teen";
      MaxAdContentRating2["MatureAudience"] = "MatureAudience";
    })(MaxAdContentRating || (MaxAdContentRating = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-options.interface.js
var init_banner_ad_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-plugin-events.enum.js
var BannerAdPluginEvents;
var init_banner_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-plugin-events.enum.js"() {
    (function(BannerAdPluginEvents2) {
      BannerAdPluginEvents2["SizeChanged"] = "bannerAdSizeChanged";
      BannerAdPluginEvents2["Loaded"] = "bannerAdLoaded";
      BannerAdPluginEvents2["FailedToLoad"] = "bannerAdFailedToLoad";
      BannerAdPluginEvents2["Opened"] = "bannerAdOpened";
      BannerAdPluginEvents2["Closed"] = "bannerAdClosed";
      BannerAdPluginEvents2["AdImpression"] = "bannerAdImpression";
      BannerAdPluginEvents2["AdPaid"] = "bannerAdPaid";
    })(BannerAdPluginEvents || (BannerAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-position.enum.js
var BannerAdPosition;
var init_banner_ad_position_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-position.enum.js"() {
    (function(BannerAdPosition2) {
      BannerAdPosition2["TOP_CENTER"] = "TOP_CENTER";
      BannerAdPosition2["CENTER"] = "CENTER";
      BannerAdPosition2["BOTTOM_CENTER"] = "BOTTOM_CENTER";
    })(BannerAdPosition || (BannerAdPosition = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-size.enum.js
var BannerAdSize;
var init_banner_ad_size_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-ad-size.enum.js"() {
    (function(BannerAdSize2) {
      BannerAdSize2["BANNER"] = "BANNER";
      BannerAdSize2["FULL_BANNER"] = "FULL_BANNER";
      BannerAdSize2["LARGE_BANNER"] = "LARGE_BANNER";
      BannerAdSize2["MEDIUM_RECTANGLE"] = "MEDIUM_RECTANGLE";
      BannerAdSize2["LEADERBOARD"] = "LEADERBOARD";
      BannerAdSize2["ADAPTIVE_BANNER"] = "ADAPTIVE_BANNER";
      BannerAdSize2["SMART_BANNER"] = "SMART_BANNER";
    })(BannerAdSize || (BannerAdSize = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-definitions.interface.js
var init_banner_definitions_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-definitions.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/banner-size.interface.js
var init_banner_size_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/banner-size.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/banner/index.js
var init_banner = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/banner/index.js"() {
    init_banner_ad_options_interface();
    init_banner_ad_plugin_events_enum();
    init_banner_ad_position_enum();
    init_banner_ad_size_enum();
    init_banner_definitions_interface();
    init_banner_size_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/interstitial/interstitial-ad-plugin-events.enum.js
var InterstitialAdPluginEvents;
var init_interstitial_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/interstitial/interstitial-ad-plugin-events.enum.js"() {
    (function(InterstitialAdPluginEvents2) {
      InterstitialAdPluginEvents2["Loaded"] = "interstitialAdLoaded";
      InterstitialAdPluginEvents2["FailedToLoad"] = "interstitialAdFailedToLoad";
      InterstitialAdPluginEvents2["Showed"] = "interstitialAdShowed";
      InterstitialAdPluginEvents2["FailedToShow"] = "interstitialAdFailedToShow";
      InterstitialAdPluginEvents2["Dismissed"] = "interstitialAdDismissed";
      InterstitialAdPluginEvents2["AdImpression"] = "interstitialAdImpression";
    })(InterstitialAdPluginEvents || (InterstitialAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/interstitial/interstitial-definitions.interface.js
var init_interstitial_definitions_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/interstitial/interstitial-definitions.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/interstitial/index.js
var init_interstitial = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/interstitial/index.js"() {
    init_interstitial_ad_plugin_events_enum();
    init_interstitial_definitions_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-ad-plugin-events.enum.js
var RewardInterstitialAdPluginEvents;
var init_reward_interstitial_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-ad-plugin-events.enum.js"() {
    (function(RewardInterstitialAdPluginEvents2) {
      RewardInterstitialAdPluginEvents2["Loaded"] = "onRewardedInterstitialAdLoaded";
      RewardInterstitialAdPluginEvents2["FailedToLoad"] = "onRewardedInterstitialAdFailedToLoad";
      RewardInterstitialAdPluginEvents2["Showed"] = "onRewardedInterstitialAdShowed";
      RewardInterstitialAdPluginEvents2["FailedToShow"] = "onRewardedInterstitialAdFailedToShow";
      RewardInterstitialAdPluginEvents2["Dismissed"] = "onRewardedInterstitialAdDismissed";
      RewardInterstitialAdPluginEvents2["Rewarded"] = "onRewardedInterstitialAdReward";
      RewardInterstitialAdPluginEvents2["AdImpression"] = "onRewardedInterstitialAdImpression";
    })(RewardInterstitialAdPluginEvents || (RewardInterstitialAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-definitions.interface.js
var init_reward_interstitial_definitions_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-definitions.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-item.interface.js
var init_reward_interstitial_item_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-item.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-ad-options.interface.js
var init_reward_interstitial_ad_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/reward-interstitial-ad-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/index.js
var init_reward_interstitial = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward-interstitial/index.js"() {
    init_reward_interstitial_ad_plugin_events_enum();
    init_reward_interstitial_definitions_interface();
    init_reward_interstitial_item_interface();
    init_reward_interstitial_ad_options_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward/reward-ad-plugin-events.enum.js
var RewardAdPluginEvents;
var init_reward_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward/reward-ad-plugin-events.enum.js"() {
    (function(RewardAdPluginEvents2) {
      RewardAdPluginEvents2["adClicked"] = "onRewardedVideoAdClicked";
      RewardAdPluginEvents2["Loaded"] = "onRewardedVideoAdLoaded";
      RewardAdPluginEvents2["FailedToLoad"] = "onRewardedVideoAdFailedToLoad";
      RewardAdPluginEvents2["Showed"] = "onRewardedVideoAdShowed";
      RewardAdPluginEvents2["FailedToShow"] = "onRewardedVideoAdFailedToShow";
      RewardAdPluginEvents2["Dismissed"] = "onRewardedVideoAdDismissed";
      RewardAdPluginEvents2["Rewarded"] = "onRewardedVideoAdReward";
      RewardAdPluginEvents2["AdImpression"] = "onRewardedVideoAdImpression";
    })(RewardAdPluginEvents || (RewardAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward/reward-definitions.interface.js
var init_reward_definitions_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward/reward-definitions.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward/reward-item.interface.js
var init_reward_item_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward/reward-item.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward/reward-ad-options.interface.js
var init_reward_ad_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward/reward-ad-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/reward/index.js
var init_reward = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/reward/index.js"() {
    init_reward_ad_plugin_events_enum();
    init_reward_definitions_interface();
    init_reward_item_interface();
    init_reward_ad_options_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/consent-status.enum.js
var AdmobConsentStatus;
var init_consent_status_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/consent-status.enum.js"() {
    (function(AdmobConsentStatus2) {
      AdmobConsentStatus2["NOT_REQUIRED"] = "NOT_REQUIRED";
      AdmobConsentStatus2["OBTAINED"] = "OBTAINED";
      AdmobConsentStatus2["REQUIRED"] = "REQUIRED";
      AdmobConsentStatus2["UNKNOWN"] = "UNKNOWN";
    })(AdmobConsentStatus || (AdmobConsentStatus = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/consent-debug-geography.enum.js
var AdmobConsentDebugGeography;
var init_consent_debug_geography_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/consent-debug-geography.enum.js"() {
    (function(AdmobConsentDebugGeography2) {
      AdmobConsentDebugGeography2[AdmobConsentDebugGeography2["DISABLED"] = 0] = "DISABLED";
      AdmobConsentDebugGeography2[AdmobConsentDebugGeography2["EEA"] = 1] = "EEA";
      AdmobConsentDebugGeography2[AdmobConsentDebugGeography2["NOT_EEA"] = 2] = "NOT_EEA";
      AdmobConsentDebugGeography2[AdmobConsentDebugGeography2["US"] = 3] = "US";
      AdmobConsentDebugGeography2[AdmobConsentDebugGeography2["OTHER"] = 4] = "OTHER";
    })(AdmobConsentDebugGeography || (AdmobConsentDebugGeography = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/consent-request-options.interface.js
var init_consent_request_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/consent-request-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/consent-info.interface.js
var init_consent_info_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/consent-info.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/consent-definition.interface.js
var init_consent_definition_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/consent-definition.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/index.js
var init_consent = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/index.js"() {
    init_consent_status_enum();
    init_consent_debug_geography_enum();
    init_consent_request_options_interface();
    init_consent_info_interface();
    init_consent_definition_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/ad-load-info.interface.js
var init_ad_load_info_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/ad-load-info.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/ad-options.interface.js
var init_ad_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/ad-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/ad-show-options.interface.js
var init_ad_show_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/ad-show-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/admob-error.interface.js
var init_admob_error_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/admob-error.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/ad-mob-revenue-data.interface.js
var AdValuePrecision;
var init_ad_mob_revenue_data_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/ad-mob-revenue-data.interface.js"() {
    (function(AdValuePrecision2) {
      AdValuePrecision2[AdValuePrecision2["Unknown"] = 0] = "Unknown";
      AdValuePrecision2[AdValuePrecision2["Estimated"] = 1] = "Estimated";
      AdValuePrecision2[AdValuePrecision2["PublisherProvided"] = 2] = "PublisherProvided";
      AdValuePrecision2[AdValuePrecision2["Precise"] = 3] = "Precise";
    })(AdValuePrecision || (AdValuePrecision = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/shared/index.js
var init_shared = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/shared/index.js"() {
    init_ad_load_info_interface();
    init_ad_options_interface();
    init_ad_show_options_interface();
    init_admob_error_interface();
    init_ad_mob_revenue_data_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-ad-options.interface.js
var init_app_open_ad_options_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-ad-options.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-ad-plugin-events.enum.js
var AppOpenAdPluginEvents;
var init_app_open_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-ad-plugin-events.enum.js"() {
    (function(AppOpenAdPluginEvents2) {
      AppOpenAdPluginEvents2["Loaded"] = "appOpenAdLoaded";
      AppOpenAdPluginEvents2["FailedToLoad"] = "appOpenAdFailedToLoad";
      AppOpenAdPluginEvents2["Opened"] = "appOpenAdOpened";
      AppOpenAdPluginEvents2["Closed"] = "appOpenAdClosed";
      AppOpenAdPluginEvents2["FailedToShow"] = "appOpenAdFailedToShow";
      AppOpenAdPluginEvents2["AdImpression"] = "appOpenAdImpression";
    })(AppOpenAdPluginEvents || (AppOpenAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-definitions.interface.js
var init_app_open_definitions_interface = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/app-open/app-open-definitions.interface.js"() {
  }
});

// node_modules/@capacitor-community/admob/dist/esm/app-open/index.js
var init_app_open = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/app-open/index.js"() {
    init_app_open_ad_options_interface();
    init_app_open_ad_plugin_events_enum();
    init_app_open_definitions_interface();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-plugin-events.enum.js
var NativeAdPluginEvents;
var init_native_ad_plugin_events_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/native-ad-plugin-events.enum.js"() {
    (function(NativeAdPluginEvents2) {
      NativeAdPluginEvents2["Loaded"] = "nativeAdLoaded";
      NativeAdPluginEvents2["FailedToLoad"] = "nativeAdFailedToLoad";
      NativeAdPluginEvents2["Clicked"] = "nativeAdClicked";
      NativeAdPluginEvents2["AdImpression"] = "nativeAdImpression";
      NativeAdPluginEvents2["Opened"] = "nativeAdOpened";
      NativeAdPluginEvents2["Closed"] = "nativeAdClosed";
      NativeAdPluginEvents2["AdPaid"] = "nativeAdPaid";
    })(NativeAdPluginEvents || (NativeAdPluginEvents = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/native-ads/index.js
var init_native_ads = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/native-ads/index.js"() {
    init_native_ad_feed();
    init_native_ad_plugin_events_enum();
    init_native_ad_template_enum();
  }
});

// node_modules/@capacitor-community/admob/dist/esm/consent/privacy-options-requirement-status.enum.js
var PrivacyOptionsRequirementStatus;
var init_privacy_options_requirement_status_enum = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/consent/privacy-options-requirement-status.enum.js"() {
    (function(PrivacyOptionsRequirementStatus2) {
      PrivacyOptionsRequirementStatus2["NOT_REQUIRED"] = "NOT_REQUIRED";
      PrivacyOptionsRequirementStatus2["REQUIRED"] = "REQUIRED";
      PrivacyOptionsRequirementStatus2["UNKNOWN"] = "UNKNOWN";
    })(PrivacyOptionsRequirementStatus || (PrivacyOptionsRequirementStatus = {}));
  }
});

// node_modules/@capacitor-community/admob/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  AdMobWeb: () => AdMobWeb
});
var AdMobWeb;
var init_web = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/web.js"() {
    init_dist();
    init_consent_status_enum();
    init_privacy_options_requirement_status_enum();
    AdMobWeb = class extends WebPlugin {
      async initialize() {
        console.log("initialize");
      }
      async requestTrackingAuthorization() {
        console.log("requestTrackingAuthorization");
      }
      async trackingAuthorizationStatus() {
        return {
          status: "authorized"
        };
      }
      async requestConsentInfo(options) {
        console.log("requestConsentInfo", options);
        return {
          status: AdmobConsentStatus.REQUIRED,
          isConsentFormAvailable: true,
          canRequestAds: true,
          privacyOptionsRequirementStatus: PrivacyOptionsRequirementStatus.REQUIRED
        };
      }
      async showPrivacyOptionsForm() {
        console.log("showPrivacyOptionsForm");
      }
      async showConsentForm() {
        console.log("showConsentForm");
        return {
          status: AdmobConsentStatus.REQUIRED,
          canRequestAds: true,
          privacyOptionsRequirementStatus: PrivacyOptionsRequirementStatus.REQUIRED
        };
      }
      async resetConsentInfo() {
        console.log("resetConsentInfo");
      }
      async setApplicationMuted(options) {
        console.log("setApplicationMuted", options);
      }
      async setApplicationVolume(options) {
        console.log("setApplicationVolume", options);
      }
      async showBanner(options) {
        console.log("showBanner", options);
      }
      async hideBanner() {
        console.log("hideBanner");
      }
      async resumeBanner() {
        console.log("resumeBanner");
      }
      async removeBanner() {
        console.log("removeBanner");
      }
      async startNativeAdFeed() {
        throw new Error("Native ads are only available on iOS and Android");
      }
      async destroyNativeAdFeed(options) {
        console.log("destroyNativeAdFeed", options);
      }
      async loadNativeAd() {
        throw new Error("Native ads are only available on iOS and Android");
      }
      async updateNativeAdPlacements(options) {
        console.log("updateNativeAdPlacements", options);
      }
      async removeNativeAd(options) {
        console.log("removeNativeAd", options);
      }
      async prepareInterstitial(options) {
        console.log("prepareInterstitial", options);
        return {
          adUnitId: options.adId
        };
      }
      async showInterstitial(options) {
        console.log("showInterstitial", options);
      }
      async prepareRewardVideoAd(options) {
        console.log("prepareRewardVideoAd", options);
        return {
          adUnitId: options.adId
        };
      }
      async showRewardVideoAd(options) {
        console.log("showRewardVideoAd", options);
        return {
          type: "",
          amount: 0
        };
      }
      async prepareRewardInterstitialAd(options) {
        console.log("prepareRewardInterstitialAd", options);
        return {
          adUnitId: options.adId
        };
      }
      async showRewardInterstitialAd(options) {
        console.log("showRewardInterstitialAd", options);
        return {
          type: "",
          amount: 0
        };
      }
      async loadAppOpen(options) {
        console.log("loadAppOpen", options);
        return {
          adUnitId: options.adId
        };
      }
      async showAppOpen(options) {
        console.log("showAppOpen", options);
      }
      async isAppOpenLoaded() {
        return { value: false };
      }
      addListener(eventName, listenerFunc) {
        void listenerFunc;
        console.log("addListener", eventName);
        return Promise.resolve({ remove: () => Promise.resolve() });
      }
    };
  }
});

// node_modules/@capacitor-community/admob/dist/esm/index.js
var esm_exports = {};
__export(esm_exports, {
  AdMob: () => AdMob,
  AdValuePrecision: () => AdValuePrecision,
  AdmobConsentDebugGeography: () => AdmobConsentDebugGeography,
  AdmobConsentStatus: () => AdmobConsentStatus,
  AppOpenAdPluginEvents: () => AppOpenAdPluginEvents,
  BannerAdPluginEvents: () => BannerAdPluginEvents,
  BannerAdPosition: () => BannerAdPosition,
  BannerAdSize: () => BannerAdSize,
  InterstitialAdPluginEvents: () => InterstitialAdPluginEvents,
  MaxAdContentRating: () => MaxAdContentRating,
  NativeAdFeed: () => NativeAdFeed,
  NativeAdPluginEvents: () => NativeAdPluginEvents,
  NativeAdTemplate: () => NativeAdTemplate,
  RewardAdPluginEvents: () => RewardAdPluginEvents,
  RewardInterstitialAdPluginEvents: () => RewardInterstitialAdPluginEvents
});
var nativeAdBridge, AdMob;
var init_esm = __esm({
  "node_modules/@capacitor-community/admob/dist/esm/index.js"() {
    init_dist();
    init_native_ad_feed();
    init_definitions();
    init_banner();
    init_interstitial();
    init_reward_interstitial();
    init_reward();
    init_consent();
    init_shared();
    init_app_open();
    init_native_ads();
    nativeAdBridge = registerPlugin("AdMob", {
      web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AdMobWeb())
    });
    AdMob = nativeAdBridge;
    configureNativeAdBridge(nativeAdBridge);
  }
});

// systems/rewarded-ads.js
var TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
var admobInitialized = false;
var rewardedAdInProgress = false;
function isRewardedAdAvailable() {
  return window.Capacitor?.isNativePlatform?.() === true && window.Capacitor?.getPlatform?.() === "android";
}
async function showRewardedAd() {
  if (!isRewardedAdAvailable()) {
    throw new Error("Rewarded ads require the installed Android app.");
  }
  if (rewardedAdInProgress) {
    throw new Error("A rewarded ad is already in progress.");
  }
  const config = window.CryptsAdMobConfig;
  if (!config || !["test", "production"].includes(config.mode) || typeof config.androidRewardedAdUnitId !== "string" || !config.androidRewardedAdUnitId.trim()) {
    throw new Error("Configure a valid Android rewarded-ad unit ID before requesting an ad.");
  }
  if (config.mode === "production" && config.androidRewardedAdUnitId === TEST_REWARDED_AD_UNIT_ID) {
    throw new Error("Replace the test rewarded-ad unit ID before enabling production ads.");
  }
  rewardedAdInProgress = true;
  try {
    const { AdMob: AdMob2 } = await Promise.resolve().then(() => (init_esm(), esm_exports));
    if (!admobInitialized) {
      await AdMob2.initialize({ initializeForTesting: config.mode === "test" });
      admobInitialized = true;
    }
    await AdMob2.prepareRewardVideoAd({
      adId: config.androidRewardedAdUnitId,
      isTesting: config.mode === "test",
      immersiveMode: true
    });
    const reward = await AdMob2.showRewardVideoAd();
    return Number.isFinite(reward?.amount) && reward.amount > 0;
  } finally {
    rewardedAdInProgress = false;
  }
}
window.CryptsRewardedAds = Object.freeze({
  isAvailable: isRewardedAdAvailable,
  showRewardedAd
});
/*! Bundled license information:

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/

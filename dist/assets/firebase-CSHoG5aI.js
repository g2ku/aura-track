var fo={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ca=function(n){const t=[];let e=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?t[e++]=i:i<2048?(t[e++]=i>>6|192,t[e++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),t[e++]=i>>18|240,t[e++]=i>>12&63|128,t[e++]=i>>6&63|128,t[e++]=i&63|128):(t[e++]=i>>12|224,t[e++]=i>>6&63|128,t[e++]=i&63|128)}return t},El=function(n){const t=[];let e=0,r=0;for(;e<n.length;){const i=n[e++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){const o=n[e++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){const o=n[e++],a=n[e++],c=n[e++],h=((i&7)<<18|(o&63)<<12|(a&63)<<6|c&63)-65536;t[r++]=String.fromCharCode(55296+(h>>10)),t[r++]=String.fromCharCode(56320+(h&1023))}else{const o=n[e++],a=n[e++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|a&63)}}return t.join("")},ha={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,t){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const e=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const o=n[i],a=i+1<n.length,c=a?n[i+1]:0,h=i+2<n.length,f=h?n[i+2]:0,p=o>>2,I=(o&3)<<4|c>>4;let w=(c&15)<<2|f>>6,V=f&63;h||(V=64,a||(w=64)),r.push(e[p],e[I],e[w],e[V])}return r.join("")},encodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(n):this.encodeByteArray(ca(n),t)},decodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(n):El(this.decodeStringToByteArray(n,t))},decodeStringToByteArray(n,t){this.init_();const e=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const o=e[n.charAt(i++)],c=i<n.length?e[n.charAt(i)]:0;++i;const f=i<n.length?e[n.charAt(i)]:64;++i;const I=i<n.length?e[n.charAt(i)]:64;if(++i,o==null||c==null||f==null||I==null)throw new vl;const w=o<<2|c>>4;if(r.push(w),f!==64){const V=c<<4&240|f>>2;if(r.push(V),I!==64){const D=f<<6&192|I;r.push(D)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class vl extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Tl=function(n){const t=ca(n);return ha.encodeByteArray(t,!0)},Xn=function(n){return Tl(n).replace(/\./g,"")},Il=function(n){try{return ha.decodeString(n,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Al(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wl=()=>Al().__FIREBASE_DEFAULTS__,Rl=()=>{if(typeof process>"u"||typeof fo>"u")return;const n=fo.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Pl=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const t=n&&Il(n[1]);return t&&JSON.parse(t)},As=()=>{try{return wl()||Rl()||Pl()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Vl=n=>{var t,e;return(e=(t=As())===null||t===void 0?void 0:t.emulatorHosts)===null||e===void 0?void 0:e[n]},Sl=n=>{const t=Vl(n);if(!t)return;const e=t.lastIndexOf(":");if(e<=0||e+1===t.length)throw new Error(`Invalid host ${t} with no separate hostname and port!`);const r=parseInt(t.substring(e+1),10);return t[0]==="["?[t.substring(1,e-1),r]:[t.substring(0,e),r]},da=()=>{var n;return(n=As())===null||n===void 0?void 0:n.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cl{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,e)=>{this.resolve=t,this.reject=e})}wrapCallback(t){return(e,r)=>{e?this.reject(e):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(e):t(e,r))}}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bl(n,t){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const e={alg:"none",type:"JWT"},r=t||"demo-project",i=n.iat||0,o=n.sub||n.user_id;if(!o)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const a=Object.assign({iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:o,user_id:o,firebase:{sign_in_provider:"custom",identities:{}}},n);return[Xn(JSON.stringify(e)),Xn(JSON.stringify(a)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dl(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Nl(){var n;const t=(n=As())===null||n===void 0?void 0:n.forceEnvironment;if(t==="node")return!0;if(t==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function kl(){return!Nl()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Ml(){try{return typeof indexedDB=="object"}catch{return!1}}function Ol(){return new Promise((n,t)=>{try{let e=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),e||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{e=!1},i.onerror=()=>{var o;t(((o=i.error)===null||o===void 0?void 0:o.message)||"")}}catch(e){t(e)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xl="FirebaseError";class Se extends Error{constructor(t,e,r){super(e),this.code=t,this.customData=r,this.name=xl,Object.setPrototypeOf(this,Se.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,fa.prototype.create)}}class fa{constructor(t,e,r){this.service=t,this.serviceName=e,this.errors=r}create(t,...e){const r=e[0]||{},i=`${this.service}/${t}`,o=this.errors[t],a=o?Ll(o,r):"Error",c=`${this.serviceName}: ${a} (${i}).`;return new Se(i,c,r)}}function Ll(n,t){return n.replace(Fl,(e,r)=>{const i=t[r];return i!=null?String(i):`<${r}?>`})}const Fl=/\{\$([^}]+)}/g;function es(n,t){if(n===t)return!0;const e=Object.keys(n),r=Object.keys(t);for(const i of e){if(!r.includes(i))return!1;const o=n[i],a=t[i];if(po(o)&&po(a)){if(!es(o,a))return!1}else if(o!==a)return!1}for(const i of r)if(!e.includes(i))return!1;return!0}function po(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bt(n){return n&&n._delegate?n._delegate:n}class on{constructor(t,e,r){this.name=t,this.instanceFactory=e,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const se="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ul{constructor(t,e){this.name=t,this.container=e,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){const e=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(e)){const r=new Cl;if(this.instancesDeferred.set(e,r),this.isInitialized(e)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:e});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(e).promise}getImmediate(t){var e;const r=this.normalizeInstanceIdentifier(t?.identifier),i=(e=t?.optional)!==null&&e!==void 0?e:!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(o){if(i)return null;throw o}else{if(i)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(ql(t))try{this.getOrInitializeService({instanceIdentifier:se})}catch{}for(const[e,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(e);try{const o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=se){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){const t=Array.from(this.instances.values());await Promise.all([...t.filter(e=>"INTERNAL"in e).map(e=>e.INTERNAL.delete()),...t.filter(e=>"_delete"in e).map(e=>e._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=se){return this.instances.has(t)}getOptions(t=se){return this.instancesOptions.get(t)||{}}initialize(t={}){const{options:e={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:e});for(const[o,a]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(o);r===c&&a.resolve(i)}return i}onInit(t,e){var r;const i=this.normalizeInstanceIdentifier(e),o=(r=this.onInitCallbacks.get(i))!==null&&r!==void 0?r:new Set;o.add(t),this.onInitCallbacks.set(i,o);const a=this.instances.get(i);return a&&t(a,i),()=>{o.delete(t)}}invokeOnInitCallbacks(t,e){const r=this.onInitCallbacks.get(e);if(r)for(const i of r)try{i(t,e)}catch{}}getOrInitializeService({instanceIdentifier:t,options:e={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:Bl(t),options:e}),this.instances.set(t,r),this.instancesOptions.set(t,e),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=se){return this.component?this.component.multipleInstances?t:se:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Bl(n){return n===se?void 0:n}function ql(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jl{constructor(t){this.name=t,this.providers=new Map}addComponent(t){const e=this.getProvider(t.name);if(e.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);e.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);const e=new Ul(t,this);return this.providers.set(t,e),e}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var q;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(q||(q={}));const $l={debug:q.DEBUG,verbose:q.VERBOSE,info:q.INFO,warn:q.WARN,error:q.ERROR,silent:q.SILENT},zl=q.INFO,Gl={[q.DEBUG]:"log",[q.VERBOSE]:"log",[q.INFO]:"info",[q.WARN]:"warn",[q.ERROR]:"error"},Kl=(n,t,...e)=>{if(t<n.logLevel)return;const r=new Date().toISOString(),i=Gl[t];if(i)console[i](`[${r}]  ${n.name}:`,...e);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)};class pa{constructor(t){this.name=t,this._logLevel=zl,this._logHandler=Kl,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in q))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?$l[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,q.DEBUG,...t),this._logHandler(this,q.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,q.VERBOSE,...t),this._logHandler(this,q.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,q.INFO,...t),this._logHandler(this,q.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,q.WARN,...t),this._logHandler(this,q.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,q.ERROR,...t),this._logHandler(this,q.ERROR,...t)}}const Wl=(n,t)=>t.some(e=>n instanceof e);let mo,go;function Ql(){return mo||(mo=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Hl(){return go||(go=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const ma=new WeakMap,ns=new WeakMap,ga=new WeakMap,Wr=new WeakMap,ws=new WeakMap;function Yl(n){const t=new Promise((e,r)=>{const i=()=>{n.removeEventListener("success",o),n.removeEventListener("error",a)},o=()=>{e(Gt(n.result)),i()},a=()=>{r(n.error),i()};n.addEventListener("success",o),n.addEventListener("error",a)});return t.then(e=>{e instanceof IDBCursor&&ma.set(e,n)}).catch(()=>{}),ws.set(t,n),t}function Xl(n){if(ns.has(n))return;const t=new Promise((e,r)=>{const i=()=>{n.removeEventListener("complete",o),n.removeEventListener("error",a),n.removeEventListener("abort",a)},o=()=>{e(),i()},a=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",o),n.addEventListener("error",a),n.addEventListener("abort",a)});ns.set(n,t)}let rs={get(n,t,e){if(n instanceof IDBTransaction){if(t==="done")return ns.get(n);if(t==="objectStoreNames")return n.objectStoreNames||ga.get(n);if(t==="store")return e.objectStoreNames[1]?void 0:e.objectStore(e.objectStoreNames[0])}return Gt(n[t])},set(n,t,e){return n[t]=e,!0},has(n,t){return n instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in n}};function Jl(n){rs=n(rs)}function Zl(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...e){const r=n.call(Qr(this),t,...e);return ga.set(r,t.sort?t.sort():[t]),Gt(r)}:Hl().includes(n)?function(...t){return n.apply(Qr(this),t),Gt(ma.get(this))}:function(...t){return Gt(n.apply(Qr(this),t))}}function tc(n){return typeof n=="function"?Zl(n):(n instanceof IDBTransaction&&Xl(n),Wl(n,Ql())?new Proxy(n,rs):n)}function Gt(n){if(n instanceof IDBRequest)return Yl(n);if(Wr.has(n))return Wr.get(n);const t=tc(n);return t!==n&&(Wr.set(n,t),ws.set(t,n)),t}const Qr=n=>ws.get(n);function ec(n,t,{blocked:e,upgrade:r,blocking:i,terminated:o}={}){const a=indexedDB.open(n,t),c=Gt(a);return r&&a.addEventListener("upgradeneeded",h=>{r(Gt(a.result),h.oldVersion,h.newVersion,Gt(a.transaction),h)}),e&&a.addEventListener("blocked",h=>e(h.oldVersion,h.newVersion,h)),c.then(h=>{o&&h.addEventListener("close",()=>o()),i&&h.addEventListener("versionchange",f=>i(f.oldVersion,f.newVersion,f))}).catch(()=>{}),c}const nc=["get","getKey","getAll","getAllKeys","count"],rc=["put","add","delete","clear"],Hr=new Map;function _o(n,t){if(!(n instanceof IDBDatabase&&!(t in n)&&typeof t=="string"))return;if(Hr.get(t))return Hr.get(t);const e=t.replace(/FromIndex$/,""),r=t!==e,i=rc.includes(e);if(!(e in(r?IDBIndex:IDBObjectStore).prototype)||!(i||nc.includes(e)))return;const o=async function(a,...c){const h=this.transaction(a,i?"readwrite":"readonly");let f=h.store;return r&&(f=f.index(c.shift())),(await Promise.all([f[e](...c),i&&h.done]))[0]};return Hr.set(t,o),o}Jl(n=>({...n,get:(t,e,r)=>_o(t,e)||n.get(t,e,r),has:(t,e)=>!!_o(t,e)||n.has(t,e)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sc{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(e=>{if(ic(e)){const r=e.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(e=>e).join(" ")}}function ic(n){const t=n.getComponent();return t?.type==="VERSION"}const ss="@firebase/app",yo="0.10.13";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Lt=new pa("@firebase/app"),oc="@firebase/app-compat",ac="@firebase/analytics-compat",uc="@firebase/analytics",lc="@firebase/app-check-compat",cc="@firebase/app-check",hc="@firebase/auth",dc="@firebase/auth-compat",fc="@firebase/database",pc="@firebase/data-connect",mc="@firebase/database-compat",gc="@firebase/functions",_c="@firebase/functions-compat",yc="@firebase/installations",Ec="@firebase/installations-compat",vc="@firebase/messaging",Tc="@firebase/messaging-compat",Ic="@firebase/performance",Ac="@firebase/performance-compat",wc="@firebase/remote-config",Rc="@firebase/remote-config-compat",Pc="@firebase/storage",Vc="@firebase/storage-compat",Sc="@firebase/firestore",Cc="@firebase/vertexai-preview",bc="@firebase/firestore-compat",Dc="firebase",Nc="10.14.1";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const is="[DEFAULT]",kc={[ss]:"fire-core",[oc]:"fire-core-compat",[uc]:"fire-analytics",[ac]:"fire-analytics-compat",[cc]:"fire-app-check",[lc]:"fire-app-check-compat",[hc]:"fire-auth",[dc]:"fire-auth-compat",[fc]:"fire-rtdb",[pc]:"fire-data-connect",[mc]:"fire-rtdb-compat",[gc]:"fire-fn",[_c]:"fire-fn-compat",[yc]:"fire-iid",[Ec]:"fire-iid-compat",[vc]:"fire-fcm",[Tc]:"fire-fcm-compat",[Ic]:"fire-perf",[Ac]:"fire-perf-compat",[wc]:"fire-rc",[Rc]:"fire-rc-compat",[Pc]:"fire-gcs",[Vc]:"fire-gcs-compat",[Sc]:"fire-fst",[bc]:"fire-fst-compat",[Cc]:"fire-vertex","fire-js":"fire-js",[Dc]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const an=new Map,Mc=new Map,os=new Map;function Eo(n,t){try{n.container.addComponent(t)}catch(e){Lt.debug(`Component ${t.name} failed to register with FirebaseApp ${n.name}`,e)}}function Jn(n){const t=n.name;if(os.has(t))return Lt.debug(`There were multiple attempts to register component ${t}.`),!1;os.set(t,n);for(const e of an.values())Eo(e,n);for(const e of Mc.values())Eo(e,n);return!0}function Oc(n,t){const e=n.container.getProvider("heartbeat").getImmediate({optional:!0});return e&&e.triggerHeartbeat(),n.container.getProvider(t)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xc={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},Kt=new fa("app","Firebase",xc);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lc{constructor(t,e,r){this._isDeleted=!1,this._options=Object.assign({},t),this._config=Object.assign({},e),this._name=e.name,this._automaticDataCollectionEnabled=e.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new on("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw Kt.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fc=Nc;function Uc(n,t={}){let e=n;typeof t!="object"&&(t={name:t});const r=Object.assign({name:is,automaticDataCollectionEnabled:!1},t),i=r.name;if(typeof i!="string"||!i)throw Kt.create("bad-app-name",{appName:String(i)});if(e||(e=da()),!e)throw Kt.create("no-options");const o=an.get(i);if(o){if(es(e,o.options)&&es(r,o.config))return o;throw Kt.create("duplicate-app",{appName:i})}const a=new jl(i);for(const h of os.values())a.addComponent(h);const c=new Lc(e,r,a);return an.set(i,c),c}function Bc(n=is){const t=an.get(n);if(!t&&n===is&&da())return Uc();if(!t)throw Kt.create("no-app",{appName:n});return t}function Yf(){return Array.from(an.values())}function Ee(n,t,e){var r;let i=(r=kc[n])!==null&&r!==void 0?r:n;e&&(i+=`-${e}`);const o=i.match(/\s|\//),a=t.match(/\s|\//);if(o||a){const c=[`Unable to register library "${i}" with version "${t}":`];o&&c.push(`library name "${i}" contains illegal characters (whitespace or "/")`),o&&a&&c.push("and"),a&&c.push(`version name "${t}" contains illegal characters (whitespace or "/")`),Lt.warn(c.join(" "));return}Jn(new on(`${i}-version`,()=>({library:i,version:t}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qc="firebase-heartbeat-database",jc=1,un="firebase-heartbeat-store";let Yr=null;function _a(){return Yr||(Yr=ec(qc,jc,{upgrade:(n,t)=>{switch(t){case 0:try{n.createObjectStore(un)}catch(e){console.warn(e)}}}}).catch(n=>{throw Kt.create("idb-open",{originalErrorMessage:n.message})})),Yr}async function $c(n){try{const e=(await _a()).transaction(un),r=await e.objectStore(un).get(ya(n));return await e.done,r}catch(t){if(t instanceof Se)Lt.warn(t.message);else{const e=Kt.create("idb-get",{originalErrorMessage:t?.message});Lt.warn(e.message)}}}async function vo(n,t){try{const r=(await _a()).transaction(un,"readwrite");await r.objectStore(un).put(t,ya(n)),await r.done}catch(e){if(e instanceof Se)Lt.warn(e.message);else{const r=Kt.create("idb-set",{originalErrorMessage:e?.message});Lt.warn(r.message)}}}function ya(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zc=1024,Gc=30*24*60*60*1e3;class Kc{constructor(t){this.container=t,this._heartbeatsCache=null;const e=this.container.getProvider("app").getImmediate();this._storage=new Qc(e),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var t,e;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=To();return((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((e=this._heartbeatsCache)===null||e===void 0?void 0:e.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(a=>a.date===o)?void 0:(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats=this._heartbeatsCache.heartbeats.filter(a=>{const c=new Date(a.date).valueOf();return Date.now()-c<=Gc}),this._storage.overwrite(this._heartbeatsCache))}catch(r){Lt.warn(r)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)===null||t===void 0?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const e=To(),{heartbeatsToSend:r,unsentEntries:i}=Wc(this._heartbeatsCache.heartbeats),o=Xn(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=e,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(e){return Lt.warn(e),""}}}function To(){return new Date().toISOString().substring(0,10)}function Wc(n,t=zc){const e=[];let r=n.slice();for(const i of n){const o=e.find(a=>a.agent===i.agent);if(o){if(o.dates.push(i.date),Io(e)>t){o.dates.pop();break}}else if(e.push({agent:i.agent,dates:[i.date]}),Io(e)>t){e.pop();break}r=r.slice(1)}return{heartbeatsToSend:e,unsentEntries:r}}class Qc{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ml()?Ol().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const e=await $c(this.app);return e?.heartbeats?e:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){var e;if(await this._canUseIndexedDBPromise){const i=await this.read();return vo(this.app,{lastSentHeartbeatDate:(e=t.lastSentHeartbeatDate)!==null&&e!==void 0?e:i.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){var e;if(await this._canUseIndexedDBPromise){const i=await this.read();return vo(this.app,{lastSentHeartbeatDate:(e=t.lastSentHeartbeatDate)!==null&&e!==void 0?e:i.lastSentHeartbeatDate,heartbeats:[...i.heartbeats,...t.heartbeats]})}else return}}function Io(n){return Xn(JSON.stringify({version:2,heartbeats:n})).length}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hc(n){Jn(new on("platform-logger",t=>new sc(t),"PRIVATE")),Jn(new on("heartbeat",t=>new Kc(t),"PRIVATE")),Ee(ss,yo,n),Ee(ss,yo,"esm2017"),Ee("fire-js","")}Hc("");var Yc="firebase",Xc="10.14.1";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Ee(Yc,Xc,"app");var Ao=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var oe,Ea;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function t(v,m){function _(){}_.prototype=m.prototype,v.D=m.prototype,v.prototype=new _,v.prototype.constructor=v,v.C=function(y,E,A){for(var g=Array(arguments.length-2),kt=2;kt<arguments.length;kt++)g[kt-2]=arguments[kt];return m.prototype[E].apply(y,g)}}function e(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.B=Array(this.blockSize),this.o=this.h=0,this.s()}t(r,e),r.prototype.s=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(v,m,_){_||(_=0);var y=Array(16);if(typeof m=="string")for(var E=0;16>E;++E)y[E]=m.charCodeAt(_++)|m.charCodeAt(_++)<<8|m.charCodeAt(_++)<<16|m.charCodeAt(_++)<<24;else for(E=0;16>E;++E)y[E]=m[_++]|m[_++]<<8|m[_++]<<16|m[_++]<<24;m=v.g[0],_=v.g[1],E=v.g[2];var A=v.g[3],g=m+(A^_&(E^A))+y[0]+3614090360&4294967295;m=_+(g<<7&4294967295|g>>>25),g=A+(E^m&(_^E))+y[1]+3905402710&4294967295,A=m+(g<<12&4294967295|g>>>20),g=E+(_^A&(m^_))+y[2]+606105819&4294967295,E=A+(g<<17&4294967295|g>>>15),g=_+(m^E&(A^m))+y[3]+3250441966&4294967295,_=E+(g<<22&4294967295|g>>>10),g=m+(A^_&(E^A))+y[4]+4118548399&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(E^m&(_^E))+y[5]+1200080426&4294967295,A=m+(g<<12&4294967295|g>>>20),g=E+(_^A&(m^_))+y[6]+2821735955&4294967295,E=A+(g<<17&4294967295|g>>>15),g=_+(m^E&(A^m))+y[7]+4249261313&4294967295,_=E+(g<<22&4294967295|g>>>10),g=m+(A^_&(E^A))+y[8]+1770035416&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(E^m&(_^E))+y[9]+2336552879&4294967295,A=m+(g<<12&4294967295|g>>>20),g=E+(_^A&(m^_))+y[10]+4294925233&4294967295,E=A+(g<<17&4294967295|g>>>15),g=_+(m^E&(A^m))+y[11]+2304563134&4294967295,_=E+(g<<22&4294967295|g>>>10),g=m+(A^_&(E^A))+y[12]+1804603682&4294967295,m=_+(g<<7&4294967295|g>>>25),g=A+(E^m&(_^E))+y[13]+4254626195&4294967295,A=m+(g<<12&4294967295|g>>>20),g=E+(_^A&(m^_))+y[14]+2792965006&4294967295,E=A+(g<<17&4294967295|g>>>15),g=_+(m^E&(A^m))+y[15]+1236535329&4294967295,_=E+(g<<22&4294967295|g>>>10),g=m+(E^A&(_^E))+y[1]+4129170786&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^E&(m^_))+y[6]+3225465664&4294967295,A=m+(g<<9&4294967295|g>>>23),g=E+(m^_&(A^m))+y[11]+643717713&4294967295,E=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(E^A))+y[0]+3921069994&4294967295,_=E+(g<<20&4294967295|g>>>12),g=m+(E^A&(_^E))+y[5]+3593408605&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^E&(m^_))+y[10]+38016083&4294967295,A=m+(g<<9&4294967295|g>>>23),g=E+(m^_&(A^m))+y[15]+3634488961&4294967295,E=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(E^A))+y[4]+3889429448&4294967295,_=E+(g<<20&4294967295|g>>>12),g=m+(E^A&(_^E))+y[9]+568446438&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^E&(m^_))+y[14]+3275163606&4294967295,A=m+(g<<9&4294967295|g>>>23),g=E+(m^_&(A^m))+y[3]+4107603335&4294967295,E=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(E^A))+y[8]+1163531501&4294967295,_=E+(g<<20&4294967295|g>>>12),g=m+(E^A&(_^E))+y[13]+2850285829&4294967295,m=_+(g<<5&4294967295|g>>>27),g=A+(_^E&(m^_))+y[2]+4243563512&4294967295,A=m+(g<<9&4294967295|g>>>23),g=E+(m^_&(A^m))+y[7]+1735328473&4294967295,E=A+(g<<14&4294967295|g>>>18),g=_+(A^m&(E^A))+y[12]+2368359562&4294967295,_=E+(g<<20&4294967295|g>>>12),g=m+(_^E^A)+y[5]+4294588738&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^E)+y[8]+2272392833&4294967295,A=m+(g<<11&4294967295|g>>>21),g=E+(A^m^_)+y[11]+1839030562&4294967295,E=A+(g<<16&4294967295|g>>>16),g=_+(E^A^m)+y[14]+4259657740&4294967295,_=E+(g<<23&4294967295|g>>>9),g=m+(_^E^A)+y[1]+2763975236&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^E)+y[4]+1272893353&4294967295,A=m+(g<<11&4294967295|g>>>21),g=E+(A^m^_)+y[7]+4139469664&4294967295,E=A+(g<<16&4294967295|g>>>16),g=_+(E^A^m)+y[10]+3200236656&4294967295,_=E+(g<<23&4294967295|g>>>9),g=m+(_^E^A)+y[13]+681279174&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^E)+y[0]+3936430074&4294967295,A=m+(g<<11&4294967295|g>>>21),g=E+(A^m^_)+y[3]+3572445317&4294967295,E=A+(g<<16&4294967295|g>>>16),g=_+(E^A^m)+y[6]+76029189&4294967295,_=E+(g<<23&4294967295|g>>>9),g=m+(_^E^A)+y[9]+3654602809&4294967295,m=_+(g<<4&4294967295|g>>>28),g=A+(m^_^E)+y[12]+3873151461&4294967295,A=m+(g<<11&4294967295|g>>>21),g=E+(A^m^_)+y[15]+530742520&4294967295,E=A+(g<<16&4294967295|g>>>16),g=_+(E^A^m)+y[2]+3299628645&4294967295,_=E+(g<<23&4294967295|g>>>9),g=m+(E^(_|~A))+y[0]+4096336452&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~E))+y[7]+1126891415&4294967295,A=m+(g<<10&4294967295|g>>>22),g=E+(m^(A|~_))+y[14]+2878612391&4294967295,E=A+(g<<15&4294967295|g>>>17),g=_+(A^(E|~m))+y[5]+4237533241&4294967295,_=E+(g<<21&4294967295|g>>>11),g=m+(E^(_|~A))+y[12]+1700485571&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~E))+y[3]+2399980690&4294967295,A=m+(g<<10&4294967295|g>>>22),g=E+(m^(A|~_))+y[10]+4293915773&4294967295,E=A+(g<<15&4294967295|g>>>17),g=_+(A^(E|~m))+y[1]+2240044497&4294967295,_=E+(g<<21&4294967295|g>>>11),g=m+(E^(_|~A))+y[8]+1873313359&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~E))+y[15]+4264355552&4294967295,A=m+(g<<10&4294967295|g>>>22),g=E+(m^(A|~_))+y[6]+2734768916&4294967295,E=A+(g<<15&4294967295|g>>>17),g=_+(A^(E|~m))+y[13]+1309151649&4294967295,_=E+(g<<21&4294967295|g>>>11),g=m+(E^(_|~A))+y[4]+4149444226&4294967295,m=_+(g<<6&4294967295|g>>>26),g=A+(_^(m|~E))+y[11]+3174756917&4294967295,A=m+(g<<10&4294967295|g>>>22),g=E+(m^(A|~_))+y[2]+718787259&4294967295,E=A+(g<<15&4294967295|g>>>17),g=_+(A^(E|~m))+y[9]+3951481745&4294967295,v.g[0]=v.g[0]+m&4294967295,v.g[1]=v.g[1]+(E+(g<<21&4294967295|g>>>11))&4294967295,v.g[2]=v.g[2]+E&4294967295,v.g[3]=v.g[3]+A&4294967295}r.prototype.u=function(v,m){m===void 0&&(m=v.length);for(var _=m-this.blockSize,y=this.B,E=this.h,A=0;A<m;){if(E==0)for(;A<=_;)i(this,v,A),A+=this.blockSize;if(typeof v=="string"){for(;A<m;)if(y[E++]=v.charCodeAt(A++),E==this.blockSize){i(this,y),E=0;break}}else for(;A<m;)if(y[E++]=v[A++],E==this.blockSize){i(this,y),E=0;break}}this.h=E,this.o+=m},r.prototype.v=function(){var v=Array((56>this.h?this.blockSize:2*this.blockSize)-this.h);v[0]=128;for(var m=1;m<v.length-8;++m)v[m]=0;var _=8*this.o;for(m=v.length-8;m<v.length;++m)v[m]=_&255,_/=256;for(this.u(v),v=Array(16),m=_=0;4>m;++m)for(var y=0;32>y;y+=8)v[_++]=this.g[m]>>>y&255;return v};function o(v,m){var _=c;return Object.prototype.hasOwnProperty.call(_,v)?_[v]:_[v]=m(v)}function a(v,m){this.h=m;for(var _=[],y=!0,E=v.length-1;0<=E;E--){var A=v[E]|0;y&&A==m||(_[E]=A,y=!1)}this.g=_}var c={};function h(v){return-128<=v&&128>v?o(v,function(m){return new a([m|0],0>m?-1:0)}):new a([v|0],0>v?-1:0)}function f(v){if(isNaN(v)||!isFinite(v))return I;if(0>v)return b(f(-v));for(var m=[],_=1,y=0;v>=_;y++)m[y]=v/_|0,_*=4294967296;return new a(m,0)}function p(v,m){if(v.length==0)throw Error("number format error: empty string");if(m=m||10,2>m||36<m)throw Error("radix out of range: "+m);if(v.charAt(0)=="-")return b(p(v.substring(1),m));if(0<=v.indexOf("-"))throw Error('number format error: interior "-" character');for(var _=f(Math.pow(m,8)),y=I,E=0;E<v.length;E+=8){var A=Math.min(8,v.length-E),g=parseInt(v.substring(E,E+A),m);8>A?(A=f(Math.pow(m,A)),y=y.j(A).add(f(g))):(y=y.j(_),y=y.add(f(g)))}return y}var I=h(0),w=h(1),V=h(16777216);n=a.prototype,n.m=function(){if(M(this))return-b(this).m();for(var v=0,m=1,_=0;_<this.g.length;_++){var y=this.i(_);v+=(0<=y?y:4294967296+y)*m,m*=4294967296}return v},n.toString=function(v){if(v=v||10,2>v||36<v)throw Error("radix out of range: "+v);if(D(this))return"0";if(M(this))return"-"+b(this).toString(v);for(var m=f(Math.pow(v,6)),_=this,y="";;){var E=rt(_,m).g;_=z(_,E.j(m));var A=((0<_.g.length?_.g[0]:_.h)>>>0).toString(v);if(_=E,D(_))return A+y;for(;6>A.length;)A="0"+A;y=A+y}},n.i=function(v){return 0>v?0:v<this.g.length?this.g[v]:this.h};function D(v){if(v.h!=0)return!1;for(var m=0;m<v.g.length;m++)if(v.g[m]!=0)return!1;return!0}function M(v){return v.h==-1}n.l=function(v){return v=z(this,v),M(v)?-1:D(v)?0:1};function b(v){for(var m=v.g.length,_=[],y=0;y<m;y++)_[y]=~v.g[y];return new a(_,~v.h).add(w)}n.abs=function(){return M(this)?b(this):this},n.add=function(v){for(var m=Math.max(this.g.length,v.g.length),_=[],y=0,E=0;E<=m;E++){var A=y+(this.i(E)&65535)+(v.i(E)&65535),g=(A>>>16)+(this.i(E)>>>16)+(v.i(E)>>>16);y=g>>>16,A&=65535,g&=65535,_[E]=g<<16|A}return new a(_,_[_.length-1]&-2147483648?-1:0)};function z(v,m){return v.add(b(m))}n.j=function(v){if(D(this)||D(v))return I;if(M(this))return M(v)?b(this).j(b(v)):b(b(this).j(v));if(M(v))return b(this.j(b(v)));if(0>this.l(V)&&0>v.l(V))return f(this.m()*v.m());for(var m=this.g.length+v.g.length,_=[],y=0;y<2*m;y++)_[y]=0;for(y=0;y<this.g.length;y++)for(var E=0;E<v.g.length;E++){var A=this.i(y)>>>16,g=this.i(y)&65535,kt=v.i(E)>>>16,ke=v.i(E)&65535;_[2*y+2*E]+=g*ke,K(_,2*y+2*E),_[2*y+2*E+1]+=A*ke,K(_,2*y+2*E+1),_[2*y+2*E+1]+=g*kt,K(_,2*y+2*E+1),_[2*y+2*E+2]+=A*kt,K(_,2*y+2*E+2)}for(y=0;y<m;y++)_[y]=_[2*y+1]<<16|_[2*y];for(y=m;y<2*m;y++)_[y]=0;return new a(_,0)};function K(v,m){for(;(v[m]&65535)!=v[m];)v[m+1]+=v[m]>>>16,v[m]&=65535,m++}function Q(v,m){this.g=v,this.h=m}function rt(v,m){if(D(m))throw Error("division by zero");if(D(v))return new Q(I,I);if(M(v))return m=rt(b(v),m),new Q(b(m.g),b(m.h));if(M(m))return m=rt(v,b(m)),new Q(b(m.g),m.h);if(30<v.g.length){if(M(v)||M(m))throw Error("slowDivide_ only works with positive integers.");for(var _=w,y=m;0>=y.l(v);)_=Nt(_),y=Nt(y);var E=it(_,1),A=it(y,1);for(y=it(y,2),_=it(_,2);!D(y);){var g=A.add(y);0>=g.l(v)&&(E=E.add(_),A=g),y=it(y,1),_=it(_,1)}return m=z(v,E.j(m)),new Q(E,m)}for(E=I;0<=v.l(m);){for(_=Math.max(1,Math.floor(v.m()/m.m())),y=Math.ceil(Math.log(_)/Math.LN2),y=48>=y?1:Math.pow(2,y-48),A=f(_),g=A.j(m);M(g)||0<g.l(v);)_-=y,A=f(_),g=A.j(m);D(A)&&(A=w),E=E.add(A),v=z(v,g)}return new Q(E,v)}n.A=function(v){return rt(this,v).h},n.and=function(v){for(var m=Math.max(this.g.length,v.g.length),_=[],y=0;y<m;y++)_[y]=this.i(y)&v.i(y);return new a(_,this.h&v.h)},n.or=function(v){for(var m=Math.max(this.g.length,v.g.length),_=[],y=0;y<m;y++)_[y]=this.i(y)|v.i(y);return new a(_,this.h|v.h)},n.xor=function(v){for(var m=Math.max(this.g.length,v.g.length),_=[],y=0;y<m;y++)_[y]=this.i(y)^v.i(y);return new a(_,this.h^v.h)};function Nt(v){for(var m=v.g.length+1,_=[],y=0;y<m;y++)_[y]=v.i(y)<<1|v.i(y-1)>>>31;return new a(_,v.h)}function it(v,m){var _=m>>5;m%=32;for(var y=v.g.length-_,E=[],A=0;A<y;A++)E[A]=0<m?v.i(A+_)>>>m|v.i(A+_+1)<<32-m:v.i(A+_);return new a(E,v.h)}r.prototype.digest=r.prototype.v,r.prototype.reset=r.prototype.s,r.prototype.update=r.prototype.u,Ea=r,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.A,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=f,a.fromString=p,oe=a}).apply(typeof Ao<"u"?Ao:typeof self<"u"?self:typeof window<"u"?window:{});var jn=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var va,Xe,Ta,Kn,as,Ia,Aa,wa;(function(){var n,t=typeof Object.defineProperties=="function"?Object.defineProperty:function(s,u,l){return s==Array.prototype||s==Object.prototype||(s[u]=l.value),s};function e(s){s=[typeof globalThis=="object"&&globalThis,s,typeof window=="object"&&window,typeof self=="object"&&self,typeof jn=="object"&&jn];for(var u=0;u<s.length;++u){var l=s[u];if(l&&l.Math==Math)return l}throw Error("Cannot find global object")}var r=e(this);function i(s,u){if(u)t:{var l=r;s=s.split(".");for(var d=0;d<s.length-1;d++){var T=s[d];if(!(T in l))break t;l=l[T]}s=s[s.length-1],d=l[s],u=u(d),u!=d&&u!=null&&t(l,s,{configurable:!0,writable:!0,value:u})}}function o(s,u){s instanceof String&&(s+="");var l=0,d=!1,T={next:function(){if(!d&&l<s.length){var R=l++;return{value:u(R,s[R]),done:!1}}return d=!0,{done:!0,value:void 0}}};return T[Symbol.iterator]=function(){return T},T}i("Array.prototype.values",function(s){return s||function(){return o(this,function(u,l){return l})}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var a=a||{},c=this||self;function h(s){var u=typeof s;return u=u!="object"?u:s?Array.isArray(s)?"array":u:"null",u=="array"||u=="object"&&typeof s.length=="number"}function f(s){var u=typeof s;return u=="object"&&s!=null||u=="function"}function p(s,u,l){return s.call.apply(s.bind,arguments)}function I(s,u,l){if(!s)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var T=Array.prototype.slice.call(arguments);return Array.prototype.unshift.apply(T,d),s.apply(u,T)}}return function(){return s.apply(u,arguments)}}function w(s,u,l){return w=Function.prototype.bind&&Function.prototype.bind.toString().indexOf("native code")!=-1?p:I,w.apply(null,arguments)}function V(s,u){var l=Array.prototype.slice.call(arguments,1);return function(){var d=l.slice();return d.push.apply(d,arguments),s.apply(this,d)}}function D(s,u){function l(){}l.prototype=u.prototype,s.aa=u.prototype,s.prototype=new l,s.prototype.constructor=s,s.Qb=function(d,T,R){for(var C=Array(arguments.length-2),W=2;W<arguments.length;W++)C[W-2]=arguments[W];return u.prototype[T].apply(d,C)}}function M(s){const u=s.length;if(0<u){const l=Array(u);for(let d=0;d<u;d++)l[d]=s[d];return l}return[]}function b(s,u){for(let l=1;l<arguments.length;l++){const d=arguments[l];if(h(d)){const T=s.length||0,R=d.length||0;s.length=T+R;for(let C=0;C<R;C++)s[T+C]=d[C]}else s.push(d)}}class z{constructor(u,l){this.i=u,this.j=l,this.h=0,this.g=null}get(){let u;return 0<this.h?(this.h--,u=this.g,this.g=u.next,u.next=null):u=this.i(),u}}function K(s){return/^[\s\xa0]*$/.test(s)}function Q(){var s=c.navigator;return s&&(s=s.userAgent)?s:""}function rt(s){return rt[" "](s),s}rt[" "]=function(){};var Nt=Q().indexOf("Gecko")!=-1&&!(Q().toLowerCase().indexOf("webkit")!=-1&&Q().indexOf("Edge")==-1)&&!(Q().indexOf("Trident")!=-1||Q().indexOf("MSIE")!=-1)&&Q().indexOf("Edge")==-1;function it(s,u,l){for(const d in s)u.call(l,s[d],d,s)}function v(s,u){for(const l in s)u.call(void 0,s[l],l,s)}function m(s){const u={};for(const l in s)u[l]=s[l];return u}const _="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function y(s,u){let l,d;for(let T=1;T<arguments.length;T++){d=arguments[T];for(l in d)s[l]=d[l];for(let R=0;R<_.length;R++)l=_[R],Object.prototype.hasOwnProperty.call(d,l)&&(s[l]=d[l])}}function E(s){var u=1;s=s.split(":");const l=[];for(;0<u&&s.length;)l.push(s.shift()),u--;return s.length&&l.push(s.join(":")),l}function A(s){c.setTimeout(()=>{throw s},0)}function g(){var s=Ar;let u=null;return s.g&&(u=s.g,s.g=s.g.next,s.g||(s.h=null),u.next=null),u}class kt{constructor(){this.h=this.g=null}add(u,l){const d=ke.get();d.set(u,l),this.h?this.h.next=d:this.g=d,this.h=d}}var ke=new z(()=>new Fu,s=>s.reset());class Fu{constructor(){this.next=this.g=this.h=null}set(u,l){this.h=u,this.g=l,this.next=null}reset(){this.next=this.g=this.h=null}}let Me,Oe=!1,Ar=new kt,di=()=>{const s=c.Promise.resolve(void 0);Me=()=>{s.then(Uu)}};var Uu=()=>{for(var s;s=g();){try{s.h.call(s.g)}catch(l){A(l)}var u=ke;u.j(s),100>u.h&&(u.h++,s.next=u.g,u.g=s)}Oe=!1};function Bt(){this.s=this.s,this.C=this.C}Bt.prototype.s=!1,Bt.prototype.ma=function(){this.s||(this.s=!0,this.N())},Bt.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function ht(s,u){this.type=s,this.g=this.target=u,this.defaultPrevented=!1}ht.prototype.h=function(){this.defaultPrevented=!0};var Bu=function(){if(!c.addEventListener||!Object.defineProperty)return!1;var s=!1,u=Object.defineProperty({},"passive",{get:function(){s=!0}});try{const l=()=>{};c.addEventListener("test",l,u),c.removeEventListener("test",l,u)}catch{}return s}();function xe(s,u){if(ht.call(this,s?s.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,s){var l=this.type=s.type,d=s.changedTouches&&s.changedTouches.length?s.changedTouches[0]:null;if(this.target=s.target||s.srcElement,this.g=u,u=s.relatedTarget){if(Nt){t:{try{rt(u.nodeName);var T=!0;break t}catch{}T=!1}T||(u=null)}}else l=="mouseover"?u=s.fromElement:l=="mouseout"&&(u=s.toElement);this.relatedTarget=u,d?(this.clientX=d.clientX!==void 0?d.clientX:d.pageX,this.clientY=d.clientY!==void 0?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0):(this.clientX=s.clientX!==void 0?s.clientX:s.pageX,this.clientY=s.clientY!==void 0?s.clientY:s.pageY,this.screenX=s.screenX||0,this.screenY=s.screenY||0),this.button=s.button,this.key=s.key||"",this.ctrlKey=s.ctrlKey,this.altKey=s.altKey,this.shiftKey=s.shiftKey,this.metaKey=s.metaKey,this.pointerId=s.pointerId||0,this.pointerType=typeof s.pointerType=="string"?s.pointerType:qu[s.pointerType]||"",this.state=s.state,this.i=s,s.defaultPrevented&&xe.aa.h.call(this)}}D(xe,ht);var qu={2:"touch",3:"pen",4:"mouse"};xe.prototype.h=function(){xe.aa.h.call(this);var s=this.i;s.preventDefault?s.preventDefault():s.returnValue=!1};var An="closure_listenable_"+(1e6*Math.random()|0),ju=0;function $u(s,u,l,d,T){this.listener=s,this.proxy=null,this.src=u,this.type=l,this.capture=!!d,this.ha=T,this.key=++ju,this.da=this.fa=!1}function wn(s){s.da=!0,s.listener=null,s.proxy=null,s.src=null,s.ha=null}function Rn(s){this.src=s,this.g={},this.h=0}Rn.prototype.add=function(s,u,l,d,T){var R=s.toString();s=this.g[R],s||(s=this.g[R]=[],this.h++);var C=Rr(s,u,d,T);return-1<C?(u=s[C],l||(u.fa=!1)):(u=new $u(u,this.src,R,!!d,T),u.fa=l,s.push(u)),u};function wr(s,u){var l=u.type;if(l in s.g){var d=s.g[l],T=Array.prototype.indexOf.call(d,u,void 0),R;(R=0<=T)&&Array.prototype.splice.call(d,T,1),R&&(wn(u),s.g[l].length==0&&(delete s.g[l],s.h--))}}function Rr(s,u,l,d){for(var T=0;T<s.length;++T){var R=s[T];if(!R.da&&R.listener==u&&R.capture==!!l&&R.ha==d)return T}return-1}var Pr="closure_lm_"+(1e6*Math.random()|0),Vr={};function fi(s,u,l,d,T){if(Array.isArray(u)){for(var R=0;R<u.length;R++)fi(s,u[R],l,d,T);return null}return l=gi(l),s&&s[An]?s.K(u,l,f(d)?!!d.capture:!1,T):zu(s,u,l,!1,d,T)}function zu(s,u,l,d,T,R){if(!u)throw Error("Invalid event type");var C=f(T)?!!T.capture:!!T,W=Cr(s);if(W||(s[Pr]=W=new Rn(s)),l=W.add(u,l,d,C,R),l.proxy)return l;if(d=Gu(),l.proxy=d,d.src=s,d.listener=l,s.addEventListener)Bu||(T=C),T===void 0&&(T=!1),s.addEventListener(u.toString(),d,T);else if(s.attachEvent)s.attachEvent(mi(u.toString()),d);else if(s.addListener&&s.removeListener)s.addListener(d);else throw Error("addEventListener and attachEvent are unavailable.");return l}function Gu(){function s(l){return u.call(s.src,s.listener,l)}const u=Ku;return s}function pi(s,u,l,d,T){if(Array.isArray(u))for(var R=0;R<u.length;R++)pi(s,u[R],l,d,T);else d=f(d)?!!d.capture:!!d,l=gi(l),s&&s[An]?(s=s.i,u=String(u).toString(),u in s.g&&(R=s.g[u],l=Rr(R,l,d,T),-1<l&&(wn(R[l]),Array.prototype.splice.call(R,l,1),R.length==0&&(delete s.g[u],s.h--)))):s&&(s=Cr(s))&&(u=s.g[u.toString()],s=-1,u&&(s=Rr(u,l,d,T)),(l=-1<s?u[s]:null)&&Sr(l))}function Sr(s){if(typeof s!="number"&&s&&!s.da){var u=s.src;if(u&&u[An])wr(u.i,s);else{var l=s.type,d=s.proxy;u.removeEventListener?u.removeEventListener(l,d,s.capture):u.detachEvent?u.detachEvent(mi(l),d):u.addListener&&u.removeListener&&u.removeListener(d),(l=Cr(u))?(wr(l,s),l.h==0&&(l.src=null,u[Pr]=null)):wn(s)}}}function mi(s){return s in Vr?Vr[s]:Vr[s]="on"+s}function Ku(s,u){if(s.da)s=!0;else{u=new xe(u,this);var l=s.listener,d=s.ha||s.src;s.fa&&Sr(s),s=l.call(d,u)}return s}function Cr(s){return s=s[Pr],s instanceof Rn?s:null}var br="__closure_events_fn_"+(1e9*Math.random()>>>0);function gi(s){return typeof s=="function"?s:(s[br]||(s[br]=function(u){return s.handleEvent(u)}),s[br])}function dt(){Bt.call(this),this.i=new Rn(this),this.M=this,this.F=null}D(dt,Bt),dt.prototype[An]=!0,dt.prototype.removeEventListener=function(s,u,l,d){pi(this,s,u,l,d)};function Et(s,u){var l,d=s.F;if(d)for(l=[];d;d=d.F)l.push(d);if(s=s.M,d=u.type||u,typeof u=="string")u=new ht(u,s);else if(u instanceof ht)u.target=u.target||s;else{var T=u;u=new ht(d,s),y(u,T)}if(T=!0,l)for(var R=l.length-1;0<=R;R--){var C=u.g=l[R];T=Pn(C,d,!0,u)&&T}if(C=u.g=s,T=Pn(C,d,!0,u)&&T,T=Pn(C,d,!1,u)&&T,l)for(R=0;R<l.length;R++)C=u.g=l[R],T=Pn(C,d,!1,u)&&T}dt.prototype.N=function(){if(dt.aa.N.call(this),this.i){var s=this.i,u;for(u in s.g){for(var l=s.g[u],d=0;d<l.length;d++)wn(l[d]);delete s.g[u],s.h--}}this.F=null},dt.prototype.K=function(s,u,l,d){return this.i.add(String(s),u,!1,l,d)},dt.prototype.L=function(s,u,l,d){return this.i.add(String(s),u,!0,l,d)};function Pn(s,u,l,d){if(u=s.i.g[String(u)],!u)return!0;u=u.concat();for(var T=!0,R=0;R<u.length;++R){var C=u[R];if(C&&!C.da&&C.capture==l){var W=C.listener,ot=C.ha||C.src;C.fa&&wr(s.i,C),T=W.call(ot,d)!==!1&&T}}return T&&!d.defaultPrevented}function _i(s,u,l){if(typeof s=="function")l&&(s=w(s,l));else if(s&&typeof s.handleEvent=="function")s=w(s.handleEvent,s);else throw Error("Invalid listener argument");return 2147483647<Number(u)?-1:c.setTimeout(s,u||0)}function yi(s){s.g=_i(()=>{s.g=null,s.i&&(s.i=!1,yi(s))},s.l);const u=s.h;s.h=null,s.m.apply(null,u)}class Wu extends Bt{constructor(u,l){super(),this.m=u,this.l=l,this.h=null,this.i=!1,this.g=null}j(u){this.h=arguments,this.g?this.i=!0:yi(this)}N(){super.N(),this.g&&(c.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Le(s){Bt.call(this),this.h=s,this.g={}}D(Le,Bt);var Ei=[];function vi(s){it(s.g,function(u,l){this.g.hasOwnProperty(l)&&Sr(u)},s),s.g={}}Le.prototype.N=function(){Le.aa.N.call(this),vi(this)},Le.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Dr=c.JSON.stringify,Qu=c.JSON.parse,Hu=class{stringify(s){return c.JSON.stringify(s,void 0)}parse(s){return c.JSON.parse(s,void 0)}};function Nr(){}Nr.prototype.h=null;function Ti(s){return s.h||(s.h=s.i())}function Ii(){}var Fe={OPEN:"a",kb:"b",Ja:"c",wb:"d"};function kr(){ht.call(this,"d")}D(kr,ht);function Mr(){ht.call(this,"c")}D(Mr,ht);var te={},Ai=null;function Vn(){return Ai=Ai||new dt}te.La="serverreachability";function wi(s){ht.call(this,te.La,s)}D(wi,ht);function Ue(s){const u=Vn();Et(u,new wi(u))}te.STAT_EVENT="statevent";function Ri(s,u){ht.call(this,te.STAT_EVENT,s),this.stat=u}D(Ri,ht);function vt(s){const u=Vn();Et(u,new Ri(u,s))}te.Ma="timingevent";function Pi(s,u){ht.call(this,te.Ma,s),this.size=u}D(Pi,ht);function Be(s,u){if(typeof s!="function")throw Error("Fn must not be null and must be a function");return c.setTimeout(function(){s()},u)}function qe(){this.g=!0}qe.prototype.xa=function(){this.g=!1};function Yu(s,u,l,d,T,R){s.info(function(){if(s.g)if(R)for(var C="",W=R.split("&"),ot=0;ot<W.length;ot++){var j=W[ot].split("=");if(1<j.length){var ft=j[0];j=j[1];var pt=ft.split("_");C=2<=pt.length&&pt[1]=="type"?C+(ft+"="+j+"&"):C+(ft+"=redacted&")}}else C=null;else C=R;return"XMLHTTP REQ ("+d+") [attempt "+T+"]: "+u+`
`+l+`
`+C})}function Xu(s,u,l,d,T,R,C){s.info(function(){return"XMLHTTP RESP ("+d+") [ attempt "+T+"]: "+u+`
`+l+`
`+R+" "+C})}function de(s,u,l,d){s.info(function(){return"XMLHTTP TEXT ("+u+"): "+Zu(s,l)+(d?" "+d:"")})}function Ju(s,u){s.info(function(){return"TIMEOUT: "+u})}qe.prototype.info=function(){};function Zu(s,u){if(!s.g)return u;if(!u)return null;try{var l=JSON.parse(u);if(l){for(s=0;s<l.length;s++)if(Array.isArray(l[s])){var d=l[s];if(!(2>d.length)){var T=d[1];if(Array.isArray(T)&&!(1>T.length)){var R=T[0];if(R!="noop"&&R!="stop"&&R!="close")for(var C=1;C<T.length;C++)T[C]=""}}}}return Dr(l)}catch{return u}}var Sn={NO_ERROR:0,gb:1,tb:2,sb:3,nb:4,rb:5,ub:6,Ia:7,TIMEOUT:8,xb:9},Vi={lb:"complete",Hb:"success",Ja:"error",Ia:"abort",zb:"ready",Ab:"readystatechange",TIMEOUT:"timeout",vb:"incrementaldata",yb:"progress",ob:"downloadprogress",Pb:"uploadprogress"},Or;function Cn(){}D(Cn,Nr),Cn.prototype.g=function(){return new XMLHttpRequest},Cn.prototype.i=function(){return{}},Or=new Cn;function qt(s,u,l,d){this.j=s,this.i=u,this.l=l,this.R=d||1,this.U=new Le(this),this.I=45e3,this.H=null,this.o=!1,this.m=this.A=this.v=this.L=this.F=this.S=this.B=null,this.D=[],this.g=null,this.C=0,this.s=this.u=null,this.X=-1,this.J=!1,this.O=0,this.M=null,this.W=this.K=this.T=this.P=!1,this.h=new Si}function Si(){this.i=null,this.g="",this.h=!1}var Ci={},xr={};function Lr(s,u,l){s.L=1,s.v=kn(Mt(u)),s.m=l,s.P=!0,bi(s,null)}function bi(s,u){s.F=Date.now(),bn(s),s.A=Mt(s.v);var l=s.A,d=s.R;Array.isArray(d)||(d=[String(d)]),zi(l.i,"t",d),s.C=0,l=s.j.J,s.h=new Si,s.g=uo(s.j,l?u:null,!s.m),0<s.O&&(s.M=new Wu(w(s.Y,s,s.g),s.O)),u=s.U,l=s.g,d=s.ca;var T="readystatechange";Array.isArray(T)||(T&&(Ei[0]=T.toString()),T=Ei);for(var R=0;R<T.length;R++){var C=fi(l,T[R],d||u.handleEvent,!1,u.h||u);if(!C)break;u.g[C.key]=C}u=s.H?m(s.H):{},s.m?(s.u||(s.u="POST"),u["Content-Type"]="application/x-www-form-urlencoded",s.g.ea(s.A,s.u,s.m,u)):(s.u="GET",s.g.ea(s.A,s.u,null,u)),Ue(),Yu(s.i,s.u,s.A,s.l,s.R,s.m)}qt.prototype.ca=function(s){s=s.target;const u=this.M;u&&Ot(s)==3?u.j():this.Y(s)},qt.prototype.Y=function(s){try{if(s==this.g)t:{const pt=Ot(this.g);var u=this.g.Ba();const me=this.g.Z();if(!(3>pt)&&(pt!=3||this.g&&(this.h.h||this.g.oa()||Xi(this.g)))){this.J||pt!=4||u==7||(u==8||0>=me?Ue(3):Ue(2)),Fr(this);var l=this.g.Z();this.X=l;e:if(Di(this)){var d=Xi(this.g);s="";var T=d.length,R=Ot(this.g)==4;if(!this.h.i){if(typeof TextDecoder>"u"){ee(this),je(this);var C="";break e}this.h.i=new c.TextDecoder}for(u=0;u<T;u++)this.h.h=!0,s+=this.h.i.decode(d[u],{stream:!(R&&u==T-1)});d.length=0,this.h.g+=s,this.C=0,C=this.h.g}else C=this.g.oa();if(this.o=l==200,Xu(this.i,this.u,this.A,this.l,this.R,pt,l),this.o){if(this.T&&!this.K){e:{if(this.g){var W,ot=this.g;if((W=ot.g?ot.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!K(W)){var j=W;break e}}j=null}if(l=j)de(this.i,this.l,l,"Initial handshake response via X-HTTP-Initial-Response"),this.K=!0,Ur(this,l);else{this.o=!1,this.s=3,vt(12),ee(this),je(this);break t}}if(this.P){l=!0;let Rt;for(;!this.J&&this.C<C.length;)if(Rt=tl(this,C),Rt==xr){pt==4&&(this.s=4,vt(14),l=!1),de(this.i,this.l,null,"[Incomplete Response]");break}else if(Rt==Ci){this.s=4,vt(15),de(this.i,this.l,C,"[Invalid Chunk]"),l=!1;break}else de(this.i,this.l,Rt,null),Ur(this,Rt);if(Di(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),pt!=4||C.length!=0||this.h.h||(this.s=1,vt(16),l=!1),this.o=this.o&&l,!l)de(this.i,this.l,C,"[Invalid Chunked Response]"),ee(this),je(this);else if(0<C.length&&!this.W){this.W=!0;var ft=this.j;ft.g==this&&ft.ba&&!ft.M&&(ft.j.info("Great, no buffering proxy detected. Bytes received: "+C.length),Gr(ft),ft.M=!0,vt(11))}}else de(this.i,this.l,C,null),Ur(this,C);pt==4&&ee(this),this.o&&!this.J&&(pt==4?so(this.j,this):(this.o=!1,bn(this)))}else _l(this.g),l==400&&0<C.indexOf("Unknown SID")?(this.s=3,vt(12)):(this.s=0,vt(13)),ee(this),je(this)}}}catch{}finally{}};function Di(s){return s.g?s.u=="GET"&&s.L!=2&&s.j.Ca:!1}function tl(s,u){var l=s.C,d=u.indexOf(`
`,l);return d==-1?xr:(l=Number(u.substring(l,d)),isNaN(l)?Ci:(d+=1,d+l>u.length?xr:(u=u.slice(d,d+l),s.C=d+l,u)))}qt.prototype.cancel=function(){this.J=!0,ee(this)};function bn(s){s.S=Date.now()+s.I,Ni(s,s.I)}function Ni(s,u){if(s.B!=null)throw Error("WatchDog timer not null");s.B=Be(w(s.ba,s),u)}function Fr(s){s.B&&(c.clearTimeout(s.B),s.B=null)}qt.prototype.ba=function(){this.B=null;const s=Date.now();0<=s-this.S?(Ju(this.i,this.A),this.L!=2&&(Ue(),vt(17)),ee(this),this.s=2,je(this)):Ni(this,this.S-s)};function je(s){s.j.G==0||s.J||so(s.j,s)}function ee(s){Fr(s);var u=s.M;u&&typeof u.ma=="function"&&u.ma(),s.M=null,vi(s.U),s.g&&(u=s.g,s.g=null,u.abort(),u.ma())}function Ur(s,u){try{var l=s.j;if(l.G!=0&&(l.g==s||Br(l.h,s))){if(!s.K&&Br(l.h,s)&&l.G==3){try{var d=l.Da.g.parse(u)}catch{d=null}if(Array.isArray(d)&&d.length==3){var T=d;if(T[0]==0){t:if(!l.u){if(l.g)if(l.g.F+3e3<s.F)Un(l),Ln(l);else break t;zr(l),vt(18)}}else l.za=T[1],0<l.za-l.T&&37500>T[2]&&l.F&&l.v==0&&!l.C&&(l.C=Be(w(l.Za,l),6e3));if(1>=Oi(l.h)&&l.ca){try{l.ca()}catch{}l.ca=void 0}}else re(l,11)}else if((s.K||l.g==s)&&Un(l),!K(u))for(T=l.Da.g.parse(u),u=0;u<T.length;u++){let j=T[u];if(l.T=j[0],j=j[1],l.G==2)if(j[0]=="c"){l.K=j[1],l.ia=j[2];const ft=j[3];ft!=null&&(l.la=ft,l.j.info("VER="+l.la));const pt=j[4];pt!=null&&(l.Aa=pt,l.j.info("SVER="+l.Aa));const me=j[5];me!=null&&typeof me=="number"&&0<me&&(d=1.5*me,l.L=d,l.j.info("backChannelRequestTimeoutMs_="+d)),d=l;const Rt=s.g;if(Rt){const qn=Rt.g?Rt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(qn){var R=d.h;R.g||qn.indexOf("spdy")==-1&&qn.indexOf("quic")==-1&&qn.indexOf("h2")==-1||(R.j=R.l,R.g=new Set,R.h&&(qr(R,R.h),R.h=null))}if(d.D){const Kr=Rt.g?Rt.g.getResponseHeader("X-HTTP-Session-Id"):null;Kr&&(d.ya=Kr,H(d.I,d.D,Kr))}}l.G=3,l.l&&l.l.ua(),l.ba&&(l.R=Date.now()-s.F,l.j.info("Handshake RTT: "+l.R+"ms")),d=l;var C=s;if(d.qa=ao(d,d.J?d.ia:null,d.W),C.K){xi(d.h,C);var W=C,ot=d.L;ot&&(W.I=ot),W.B&&(Fr(W),bn(W)),d.g=C}else no(d);0<l.i.length&&Fn(l)}else j[0]!="stop"&&j[0]!="close"||re(l,7);else l.G==3&&(j[0]=="stop"||j[0]=="close"?j[0]=="stop"?re(l,7):$r(l):j[0]!="noop"&&l.l&&l.l.ta(j),l.v=0)}}Ue(4)}catch{}}var el=class{constructor(s,u){this.g=s,this.map=u}};function ki(s){this.l=s||10,c.PerformanceNavigationTiming?(s=c.performance.getEntriesByType("navigation"),s=0<s.length&&(s[0].nextHopProtocol=="hq"||s[0].nextHopProtocol=="h2")):s=!!(c.chrome&&c.chrome.loadTimes&&c.chrome.loadTimes()&&c.chrome.loadTimes().wasFetchedViaSpdy),this.j=s?this.l:1,this.g=null,1<this.j&&(this.g=new Set),this.h=null,this.i=[]}function Mi(s){return s.h?!0:s.g?s.g.size>=s.j:!1}function Oi(s){return s.h?1:s.g?s.g.size:0}function Br(s,u){return s.h?s.h==u:s.g?s.g.has(u):!1}function qr(s,u){s.g?s.g.add(u):s.h=u}function xi(s,u){s.h&&s.h==u?s.h=null:s.g&&s.g.has(u)&&s.g.delete(u)}ki.prototype.cancel=function(){if(this.i=Li(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const s of this.g.values())s.cancel();this.g.clear()}};function Li(s){if(s.h!=null)return s.i.concat(s.h.D);if(s.g!=null&&s.g.size!==0){let u=s.i;for(const l of s.g.values())u=u.concat(l.D);return u}return M(s.i)}function nl(s){if(s.V&&typeof s.V=="function")return s.V();if(typeof Map<"u"&&s instanceof Map||typeof Set<"u"&&s instanceof Set)return Array.from(s.values());if(typeof s=="string")return s.split("");if(h(s)){for(var u=[],l=s.length,d=0;d<l;d++)u.push(s[d]);return u}u=[],l=0;for(d in s)u[l++]=s[d];return u}function rl(s){if(s.na&&typeof s.na=="function")return s.na();if(!s.V||typeof s.V!="function"){if(typeof Map<"u"&&s instanceof Map)return Array.from(s.keys());if(!(typeof Set<"u"&&s instanceof Set)){if(h(s)||typeof s=="string"){var u=[];s=s.length;for(var l=0;l<s;l++)u.push(l);return u}u=[],l=0;for(const d in s)u[l++]=d;return u}}}function Fi(s,u){if(s.forEach&&typeof s.forEach=="function")s.forEach(u,void 0);else if(h(s)||typeof s=="string")Array.prototype.forEach.call(s,u,void 0);else for(var l=rl(s),d=nl(s),T=d.length,R=0;R<T;R++)u.call(void 0,d[R],l&&l[R],s)}var Ui=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function sl(s,u){if(s){s=s.split("&");for(var l=0;l<s.length;l++){var d=s[l].indexOf("="),T=null;if(0<=d){var R=s[l].substring(0,d);T=s[l].substring(d+1)}else R=s[l];u(R,T?decodeURIComponent(T.replace(/\+/g," ")):"")}}}function ne(s){if(this.g=this.o=this.j="",this.s=null,this.m=this.l="",this.h=!1,s instanceof ne){this.h=s.h,Dn(this,s.j),this.o=s.o,this.g=s.g,Nn(this,s.s),this.l=s.l;var u=s.i,l=new Ge;l.i=u.i,u.g&&(l.g=new Map(u.g),l.h=u.h),Bi(this,l),this.m=s.m}else s&&(u=String(s).match(Ui))?(this.h=!1,Dn(this,u[1]||"",!0),this.o=$e(u[2]||""),this.g=$e(u[3]||"",!0),Nn(this,u[4]),this.l=$e(u[5]||"",!0),Bi(this,u[6]||"",!0),this.m=$e(u[7]||"")):(this.h=!1,this.i=new Ge(null,this.h))}ne.prototype.toString=function(){var s=[],u=this.j;u&&s.push(ze(u,qi,!0),":");var l=this.g;return(l||u=="file")&&(s.push("//"),(u=this.o)&&s.push(ze(u,qi,!0),"@"),s.push(encodeURIComponent(String(l)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),l=this.s,l!=null&&s.push(":",String(l))),(l=this.l)&&(this.g&&l.charAt(0)!="/"&&s.push("/"),s.push(ze(l,l.charAt(0)=="/"?al:ol,!0))),(l=this.i.toString())&&s.push("?",l),(l=this.m)&&s.push("#",ze(l,ll)),s.join("")};function Mt(s){return new ne(s)}function Dn(s,u,l){s.j=l?$e(u,!0):u,s.j&&(s.j=s.j.replace(/:$/,""))}function Nn(s,u){if(u){if(u=Number(u),isNaN(u)||0>u)throw Error("Bad port number "+u);s.s=u}else s.s=null}function Bi(s,u,l){u instanceof Ge?(s.i=u,cl(s.i,s.h)):(l||(u=ze(u,ul)),s.i=new Ge(u,s.h))}function H(s,u,l){s.i.set(u,l)}function kn(s){return H(s,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36)),s}function $e(s,u){return s?u?decodeURI(s.replace(/%25/g,"%2525")):decodeURIComponent(s):""}function ze(s,u,l){return typeof s=="string"?(s=encodeURI(s).replace(u,il),l&&(s=s.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),s):null}function il(s){return s=s.charCodeAt(0),"%"+(s>>4&15).toString(16)+(s&15).toString(16)}var qi=/[#\/\?@]/g,ol=/[#\?:]/g,al=/[#\?]/g,ul=/[#\?@]/g,ll=/#/g;function Ge(s,u){this.h=this.g=null,this.i=s||null,this.j=!!u}function jt(s){s.g||(s.g=new Map,s.h=0,s.i&&sl(s.i,function(u,l){s.add(decodeURIComponent(u.replace(/\+/g," ")),l)}))}n=Ge.prototype,n.add=function(s,u){jt(this),this.i=null,s=fe(this,s);var l=this.g.get(s);return l||this.g.set(s,l=[]),l.push(u),this.h+=1,this};function ji(s,u){jt(s),u=fe(s,u),s.g.has(u)&&(s.i=null,s.h-=s.g.get(u).length,s.g.delete(u))}function $i(s,u){return jt(s),u=fe(s,u),s.g.has(u)}n.forEach=function(s,u){jt(this),this.g.forEach(function(l,d){l.forEach(function(T){s.call(u,T,d,this)},this)},this)},n.na=function(){jt(this);const s=Array.from(this.g.values()),u=Array.from(this.g.keys()),l=[];for(let d=0;d<u.length;d++){const T=s[d];for(let R=0;R<T.length;R++)l.push(u[d])}return l},n.V=function(s){jt(this);let u=[];if(typeof s=="string")$i(this,s)&&(u=u.concat(this.g.get(fe(this,s))));else{s=Array.from(this.g.values());for(let l=0;l<s.length;l++)u=u.concat(s[l])}return u},n.set=function(s,u){return jt(this),this.i=null,s=fe(this,s),$i(this,s)&&(this.h-=this.g.get(s).length),this.g.set(s,[u]),this.h+=1,this},n.get=function(s,u){return s?(s=this.V(s),0<s.length?String(s[0]):u):u};function zi(s,u,l){ji(s,u),0<l.length&&(s.i=null,s.g.set(fe(s,u),M(l)),s.h+=l.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const s=[],u=Array.from(this.g.keys());for(var l=0;l<u.length;l++){var d=u[l];const R=encodeURIComponent(String(d)),C=this.V(d);for(d=0;d<C.length;d++){var T=R;C[d]!==""&&(T+="="+encodeURIComponent(String(C[d]))),s.push(T)}}return this.i=s.join("&")};function fe(s,u){return u=String(u),s.j&&(u=u.toLowerCase()),u}function cl(s,u){u&&!s.j&&(jt(s),s.i=null,s.g.forEach(function(l,d){var T=d.toLowerCase();d!=T&&(ji(this,d),zi(this,T,l))},s)),s.j=u}function hl(s,u){const l=new qe;if(c.Image){const d=new Image;d.onload=V($t,l,"TestLoadImage: loaded",!0,u,d),d.onerror=V($t,l,"TestLoadImage: error",!1,u,d),d.onabort=V($t,l,"TestLoadImage: abort",!1,u,d),d.ontimeout=V($t,l,"TestLoadImage: timeout",!1,u,d),c.setTimeout(function(){d.ontimeout&&d.ontimeout()},1e4),d.src=s}else u(!1)}function dl(s,u){const l=new qe,d=new AbortController,T=setTimeout(()=>{d.abort(),$t(l,"TestPingServer: timeout",!1,u)},1e4);fetch(s,{signal:d.signal}).then(R=>{clearTimeout(T),R.ok?$t(l,"TestPingServer: ok",!0,u):$t(l,"TestPingServer: server error",!1,u)}).catch(()=>{clearTimeout(T),$t(l,"TestPingServer: error",!1,u)})}function $t(s,u,l,d,T){try{T&&(T.onload=null,T.onerror=null,T.onabort=null,T.ontimeout=null),d(l)}catch{}}function fl(){this.g=new Hu}function pl(s,u,l){const d=l||"";try{Fi(s,function(T,R){let C=T;f(T)&&(C=Dr(T)),u.push(d+R+"="+encodeURIComponent(C))})}catch(T){throw u.push(d+"type="+encodeURIComponent("_badmap")),T}}function Mn(s){this.l=s.Ub||null,this.j=s.eb||!1}D(Mn,Nr),Mn.prototype.g=function(){return new On(this.l,this.j)},Mn.prototype.i=function(s){return function(){return s}}({});function On(s,u){dt.call(this),this.D=s,this.o=u,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.u=new Headers,this.h=null,this.B="GET",this.A="",this.g=!1,this.v=this.j=this.l=null}D(On,dt),n=On.prototype,n.open=function(s,u){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.B=s,this.A=u,this.readyState=1,We(this)},n.send=function(s){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");this.g=!0;const u={headers:this.u,method:this.B,credentials:this.m,cache:void 0};s&&(u.body=s),(this.D||c).fetch(new Request(this.A,u)).then(this.Sa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.u=new Headers,this.status=0,this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),1<=this.readyState&&this.g&&this.readyState!=4&&(this.g=!1,Ke(this)),this.readyState=0},n.Sa=function(s){if(this.g&&(this.l=s,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=s.headers,this.readyState=2,We(this)),this.g&&(this.readyState=3,We(this),this.g)))if(this.responseType==="arraybuffer")s.arrayBuffer().then(this.Qa.bind(this),this.ga.bind(this));else if(typeof c.ReadableStream<"u"&&"body"in s){if(this.j=s.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.v=new TextDecoder;Gi(this)}else s.text().then(this.Ra.bind(this),this.ga.bind(this))};function Gi(s){s.j.read().then(s.Pa.bind(s)).catch(s.ga.bind(s))}n.Pa=function(s){if(this.g){if(this.o&&s.value)this.response.push(s.value);else if(!this.o){var u=s.value?s.value:new Uint8Array(0);(u=this.v.decode(u,{stream:!s.done}))&&(this.response=this.responseText+=u)}s.done?Ke(this):We(this),this.readyState==3&&Gi(this)}},n.Ra=function(s){this.g&&(this.response=this.responseText=s,Ke(this))},n.Qa=function(s){this.g&&(this.response=s,Ke(this))},n.ga=function(){this.g&&Ke(this)};function Ke(s){s.readyState=4,s.l=null,s.j=null,s.v=null,We(s)}n.setRequestHeader=function(s,u){this.u.append(s,u)},n.getResponseHeader=function(s){return this.h&&this.h.get(s.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const s=[],u=this.h.entries();for(var l=u.next();!l.done;)l=l.value,s.push(l[0]+": "+l[1]),l=u.next();return s.join(`\r
`)};function We(s){s.onreadystatechange&&s.onreadystatechange.call(s)}Object.defineProperty(On.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(s){this.m=s?"include":"same-origin"}});function Ki(s){let u="";return it(s,function(l,d){u+=d,u+=":",u+=l,u+=`\r
`}),u}function jr(s,u,l){t:{for(d in l){var d=!1;break t}d=!0}d||(l=Ki(l),typeof s=="string"?l!=null&&encodeURIComponent(String(l)):H(s,u,l))}function J(s){dt.call(this),this.headers=new Map,this.o=s||null,this.h=!1,this.v=this.g=null,this.D="",this.m=0,this.l="",this.j=this.B=this.u=this.A=!1,this.I=null,this.H="",this.J=!1}D(J,dt);var ml=/^https?$/i,gl=["POST","PUT"];n=J.prototype,n.Ha=function(s){this.J=s},n.ea=function(s,u,l,d){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+s);u=u?u.toUpperCase():"GET",this.D=s,this.l="",this.m=0,this.A=!1,this.h=!0,this.g=this.o?this.o.g():Or.g(),this.v=this.o?Ti(this.o):Ti(Or),this.g.onreadystatechange=w(this.Ea,this);try{this.B=!0,this.g.open(u,String(s),!0),this.B=!1}catch(R){Wi(this,R);return}if(s=l||"",l=new Map(this.headers),d)if(Object.getPrototypeOf(d)===Object.prototype)for(var T in d)l.set(T,d[T]);else if(typeof d.keys=="function"&&typeof d.get=="function")for(const R of d.keys())l.set(R,d.get(R));else throw Error("Unknown input type for opt_headers: "+String(d));d=Array.from(l.keys()).find(R=>R.toLowerCase()=="content-type"),T=c.FormData&&s instanceof c.FormData,!(0<=Array.prototype.indexOf.call(gl,u,void 0))||d||T||l.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[R,C]of l)this.g.setRequestHeader(R,C);this.H&&(this.g.responseType=this.H),"withCredentials"in this.g&&this.g.withCredentials!==this.J&&(this.g.withCredentials=this.J);try{Yi(this),this.u=!0,this.g.send(s),this.u=!1}catch(R){Wi(this,R)}};function Wi(s,u){s.h=!1,s.g&&(s.j=!0,s.g.abort(),s.j=!1),s.l=u,s.m=5,Qi(s),xn(s)}function Qi(s){s.A||(s.A=!0,Et(s,"complete"),Et(s,"error"))}n.abort=function(s){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.m=s||7,Et(this,"complete"),Et(this,"abort"),xn(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),xn(this,!0)),J.aa.N.call(this)},n.Ea=function(){this.s||(this.B||this.u||this.j?Hi(this):this.bb())},n.bb=function(){Hi(this)};function Hi(s){if(s.h&&typeof a<"u"&&(!s.v[1]||Ot(s)!=4||s.Z()!=2)){if(s.u&&Ot(s)==4)_i(s.Ea,0,s);else if(Et(s,"readystatechange"),Ot(s)==4){s.h=!1;try{const C=s.Z();t:switch(C){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var u=!0;break t;default:u=!1}var l;if(!(l=u)){var d;if(d=C===0){var T=String(s.D).match(Ui)[1]||null;!T&&c.self&&c.self.location&&(T=c.self.location.protocol.slice(0,-1)),d=!ml.test(T?T.toLowerCase():"")}l=d}if(l)Et(s,"complete"),Et(s,"success");else{s.m=6;try{var R=2<Ot(s)?s.g.statusText:""}catch{R=""}s.l=R+" ["+s.Z()+"]",Qi(s)}}finally{xn(s)}}}}function xn(s,u){if(s.g){Yi(s);const l=s.g,d=s.v[0]?()=>{}:null;s.g=null,s.v=null,u||Et(s,"ready");try{l.onreadystatechange=d}catch{}}}function Yi(s){s.I&&(c.clearTimeout(s.I),s.I=null)}n.isActive=function(){return!!this.g};function Ot(s){return s.g?s.g.readyState:0}n.Z=function(){try{return 2<Ot(this)?this.g.status:-1}catch{return-1}},n.oa=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.Oa=function(s){if(this.g){var u=this.g.responseText;return s&&u.indexOf(s)==0&&(u=u.substring(s.length)),Qu(u)}};function Xi(s){try{if(!s.g)return null;if("response"in s.g)return s.g.response;switch(s.H){case"":case"text":return s.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in s.g)return s.g.mozResponseArrayBuffer}return null}catch{return null}}function _l(s){const u={};s=(s.g&&2<=Ot(s)&&s.g.getAllResponseHeaders()||"").split(`\r
`);for(let d=0;d<s.length;d++){if(K(s[d]))continue;var l=E(s[d]);const T=l[0];if(l=l[1],typeof l!="string")continue;l=l.trim();const R=u[T]||[];u[T]=R,R.push(l)}v(u,function(d){return d.join(", ")})}n.Ba=function(){return this.m},n.Ka=function(){return typeof this.l=="string"?this.l:String(this.l)};function Qe(s,u,l){return l&&l.internalChannelParams&&l.internalChannelParams[s]||u}function Ji(s){this.Aa=0,this.i=[],this.j=new qe,this.ia=this.qa=this.I=this.W=this.g=this.ya=this.D=this.H=this.m=this.S=this.o=null,this.Ya=this.U=0,this.Va=Qe("failFast",!1,s),this.F=this.C=this.u=this.s=this.l=null,this.X=!0,this.za=this.T=-1,this.Y=this.v=this.B=0,this.Ta=Qe("baseRetryDelayMs",5e3,s),this.cb=Qe("retryDelaySeedMs",1e4,s),this.Wa=Qe("forwardChannelMaxRetries",2,s),this.wa=Qe("forwardChannelRequestTimeoutMs",2e4,s),this.pa=s&&s.xmlHttpFactory||void 0,this.Xa=s&&s.Tb||void 0,this.Ca=s&&s.useFetchStreams||!1,this.L=void 0,this.J=s&&s.supportsCrossDomainXhr||!1,this.K="",this.h=new ki(s&&s.concurrentRequestLimit),this.Da=new fl,this.P=s&&s.fastHandshake||!1,this.O=s&&s.encodeInitMessageHeaders||!1,this.P&&this.O&&(this.O=!1),this.Ua=s&&s.Rb||!1,s&&s.xa&&this.j.xa(),s&&s.forceLongPolling&&(this.X=!1),this.ba=!this.P&&this.X&&s&&s.detectBufferingProxy||!1,this.ja=void 0,s&&s.longPollingTimeout&&0<s.longPollingTimeout&&(this.ja=s.longPollingTimeout),this.ca=void 0,this.R=0,this.M=!1,this.ka=this.A=null}n=Ji.prototype,n.la=8,n.G=1,n.connect=function(s,u,l,d){vt(0),this.W=s,this.H=u||{},l&&d!==void 0&&(this.H.OSID=l,this.H.OAID=d),this.F=this.X,this.I=ao(this,null,this.W),Fn(this)};function $r(s){if(Zi(s),s.G==3){var u=s.U++,l=Mt(s.I);if(H(l,"SID",s.K),H(l,"RID",u),H(l,"TYPE","terminate"),He(s,l),u=new qt(s,s.j,u),u.L=2,u.v=kn(Mt(l)),l=!1,c.navigator&&c.navigator.sendBeacon)try{l=c.navigator.sendBeacon(u.v.toString(),"")}catch{}!l&&c.Image&&(new Image().src=u.v,l=!0),l||(u.g=uo(u.j,null),u.g.ea(u.v)),u.F=Date.now(),bn(u)}oo(s)}function Ln(s){s.g&&(Gr(s),s.g.cancel(),s.g=null)}function Zi(s){Ln(s),s.u&&(c.clearTimeout(s.u),s.u=null),Un(s),s.h.cancel(),s.s&&(typeof s.s=="number"&&c.clearTimeout(s.s),s.s=null)}function Fn(s){if(!Mi(s.h)&&!s.s){s.s=!0;var u=s.Ga;Me||di(),Oe||(Me(),Oe=!0),Ar.add(u,s),s.B=0}}function yl(s,u){return Oi(s.h)>=s.h.j-(s.s?1:0)?!1:s.s?(s.i=u.D.concat(s.i),!0):s.G==1||s.G==2||s.B>=(s.Va?0:s.Wa)?!1:(s.s=Be(w(s.Ga,s,u),io(s,s.B)),s.B++,!0)}n.Ga=function(s){if(this.s)if(this.s=null,this.G==1){if(!s){this.U=Math.floor(1e5*Math.random()),s=this.U++;const T=new qt(this,this.j,s);let R=this.o;if(this.S&&(R?(R=m(R),y(R,this.S)):R=this.S),this.m!==null||this.O||(T.H=R,R=null),this.P)t:{for(var u=0,l=0;l<this.i.length;l++){e:{var d=this.i[l];if("__data__"in d.map&&(d=d.map.__data__,typeof d=="string")){d=d.length;break e}d=void 0}if(d===void 0)break;if(u+=d,4096<u){u=l;break t}if(u===4096||l===this.i.length-1){u=l+1;break t}}u=1e3}else u=1e3;u=eo(this,T,u),l=Mt(this.I),H(l,"RID",s),H(l,"CVER",22),this.D&&H(l,"X-HTTP-Session-Id",this.D),He(this,l),R&&(this.O?u="headers="+encodeURIComponent(String(Ki(R)))+"&"+u:this.m&&jr(l,this.m,R)),qr(this.h,T),this.Ua&&H(l,"TYPE","init"),this.P?(H(l,"$req",u),H(l,"SID","null"),T.T=!0,Lr(T,l,null)):Lr(T,l,u),this.G=2}}else this.G==3&&(s?to(this,s):this.i.length==0||Mi(this.h)||to(this))};function to(s,u){var l;u?l=u.l:l=s.U++;const d=Mt(s.I);H(d,"SID",s.K),H(d,"RID",l),H(d,"AID",s.T),He(s,d),s.m&&s.o&&jr(d,s.m,s.o),l=new qt(s,s.j,l,s.B+1),s.m===null&&(l.H=s.o),u&&(s.i=u.D.concat(s.i)),u=eo(s,l,1e3),l.I=Math.round(.5*s.wa)+Math.round(.5*s.wa*Math.random()),qr(s.h,l),Lr(l,d,u)}function He(s,u){s.H&&it(s.H,function(l,d){H(u,d,l)}),s.l&&Fi({},function(l,d){H(u,d,l)})}function eo(s,u,l){l=Math.min(s.i.length,l);var d=s.l?w(s.l.Na,s.l,s):null;t:{var T=s.i;let R=-1;for(;;){const C=["count="+l];R==-1?0<l?(R=T[0].g,C.push("ofs="+R)):R=0:C.push("ofs="+R);let W=!0;for(let ot=0;ot<l;ot++){let j=T[ot].g;const ft=T[ot].map;if(j-=R,0>j)R=Math.max(0,T[ot].g-100),W=!1;else try{pl(ft,C,"req"+j+"_")}catch{d&&d(ft)}}if(W){d=C.join("&");break t}}}return s=s.i.splice(0,l),u.D=s,d}function no(s){if(!s.g&&!s.u){s.Y=1;var u=s.Fa;Me||di(),Oe||(Me(),Oe=!0),Ar.add(u,s),s.v=0}}function zr(s){return s.g||s.u||3<=s.v?!1:(s.Y++,s.u=Be(w(s.Fa,s),io(s,s.v)),s.v++,!0)}n.Fa=function(){if(this.u=null,ro(this),this.ba&&!(this.M||this.g==null||0>=this.R)){var s=2*this.R;this.j.info("BP detection timer enabled: "+s),this.A=Be(w(this.ab,this),s)}},n.ab=function(){this.A&&(this.A=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.M=!0,vt(10),Ln(this),ro(this))};function Gr(s){s.A!=null&&(c.clearTimeout(s.A),s.A=null)}function ro(s){s.g=new qt(s,s.j,"rpc",s.Y),s.m===null&&(s.g.H=s.o),s.g.O=0;var u=Mt(s.qa);H(u,"RID","rpc"),H(u,"SID",s.K),H(u,"AID",s.T),H(u,"CI",s.F?"0":"1"),!s.F&&s.ja&&H(u,"TO",s.ja),H(u,"TYPE","xmlhttp"),He(s,u),s.m&&s.o&&jr(u,s.m,s.o),s.L&&(s.g.I=s.L);var l=s.g;s=s.ia,l.L=1,l.v=kn(Mt(u)),l.m=null,l.P=!0,bi(l,s)}n.Za=function(){this.C!=null&&(this.C=null,Ln(this),zr(this),vt(19))};function Un(s){s.C!=null&&(c.clearTimeout(s.C),s.C=null)}function so(s,u){var l=null;if(s.g==u){Un(s),Gr(s),s.g=null;var d=2}else if(Br(s.h,u))l=u.D,xi(s.h,u),d=1;else return;if(s.G!=0){if(u.o)if(d==1){l=u.m?u.m.length:0,u=Date.now()-u.F;var T=s.B;d=Vn(),Et(d,new Pi(d,l)),Fn(s)}else no(s);else if(T=u.s,T==3||T==0&&0<u.X||!(d==1&&yl(s,u)||d==2&&zr(s)))switch(l&&0<l.length&&(u=s.h,u.i=u.i.concat(l)),T){case 1:re(s,5);break;case 4:re(s,10);break;case 3:re(s,6);break;default:re(s,2)}}}function io(s,u){let l=s.Ta+Math.floor(Math.random()*s.cb);return s.isActive()||(l*=2),l*u}function re(s,u){if(s.j.info("Error code "+u),u==2){var l=w(s.fb,s),d=s.Xa;const T=!d;d=new ne(d||"//www.google.com/images/cleardot.gif"),c.location&&c.location.protocol=="http"||Dn(d,"https"),kn(d),T?hl(d.toString(),l):dl(d.toString(),l)}else vt(2);s.G=0,s.l&&s.l.sa(u),oo(s),Zi(s)}n.fb=function(s){s?(this.j.info("Successfully pinged google.com"),vt(2)):(this.j.info("Failed to ping google.com"),vt(1))};function oo(s){if(s.G=0,s.ka=[],s.l){const u=Li(s.h);(u.length!=0||s.i.length!=0)&&(b(s.ka,u),b(s.ka,s.i),s.h.i.length=0,M(s.i),s.i.length=0),s.l.ra()}}function ao(s,u,l){var d=l instanceof ne?Mt(l):new ne(l);if(d.g!="")u&&(d.g=u+"."+d.g),Nn(d,d.s);else{var T=c.location;d=T.protocol,u=u?u+"."+T.hostname:T.hostname,T=+T.port;var R=new ne(null);d&&Dn(R,d),u&&(R.g=u),T&&Nn(R,T),l&&(R.l=l),d=R}return l=s.D,u=s.ya,l&&u&&H(d,l,u),H(d,"VER",s.la),He(s,d),d}function uo(s,u,l){if(u&&!s.J)throw Error("Can't create secondary domain capable XhrIo object.");return u=s.Ca&&!s.pa?new J(new Mn({eb:l})):new J(s.pa),u.Ha(s.J),u}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function lo(){}n=lo.prototype,n.ua=function(){},n.ta=function(){},n.sa=function(){},n.ra=function(){},n.isActive=function(){return!0},n.Na=function(){};function Bn(){}Bn.prototype.g=function(s,u){return new It(s,u)};function It(s,u){dt.call(this),this.g=new Ji(u),this.l=s,this.h=u&&u.messageUrlParams||null,s=u&&u.messageHeaders||null,u&&u.clientProtocolHeaderRequired&&(s?s["X-Client-Protocol"]="webchannel":s={"X-Client-Protocol":"webchannel"}),this.g.o=s,s=u&&u.initMessageHeaders||null,u&&u.messageContentType&&(s?s["X-WebChannel-Content-Type"]=u.messageContentType:s={"X-WebChannel-Content-Type":u.messageContentType}),u&&u.va&&(s?s["X-WebChannel-Client-Profile"]=u.va:s={"X-WebChannel-Client-Profile":u.va}),this.g.S=s,(s=u&&u.Sb)&&!K(s)&&(this.g.m=s),this.v=u&&u.supportsCrossDomainXhr||!1,this.u=u&&u.sendRawJson||!1,(u=u&&u.httpSessionIdParam)&&!K(u)&&(this.g.D=u,s=this.h,s!==null&&u in s&&(s=this.h,u in s&&delete s[u])),this.j=new pe(this)}D(It,dt),It.prototype.m=function(){this.g.l=this.j,this.v&&(this.g.J=!0),this.g.connect(this.l,this.h||void 0)},It.prototype.close=function(){$r(this.g)},It.prototype.o=function(s){var u=this.g;if(typeof s=="string"){var l={};l.__data__=s,s=l}else this.u&&(l={},l.__data__=Dr(s),s=l);u.i.push(new el(u.Ya++,s)),u.G==3&&Fn(u)},It.prototype.N=function(){this.g.l=null,delete this.j,$r(this.g),delete this.g,It.aa.N.call(this)};function co(s){kr.call(this),s.__headers__&&(this.headers=s.__headers__,this.statusCode=s.__status__,delete s.__headers__,delete s.__status__);var u=s.__sm__;if(u){t:{for(const l in u){s=l;break t}s=void 0}(this.i=s)&&(s=this.i,u=u!==null&&s in u?u[s]:void 0),this.data=u}else this.data=s}D(co,kr);function ho(){Mr.call(this),this.status=1}D(ho,Mr);function pe(s){this.g=s}D(pe,lo),pe.prototype.ua=function(){Et(this.g,"a")},pe.prototype.ta=function(s){Et(this.g,new co(s))},pe.prototype.sa=function(s){Et(this.g,new ho)},pe.prototype.ra=function(){Et(this.g,"b")},Bn.prototype.createWebChannel=Bn.prototype.g,It.prototype.send=It.prototype.o,It.prototype.open=It.prototype.m,It.prototype.close=It.prototype.close,wa=function(){return new Bn},Aa=function(){return Vn()},Ia=te,as={mb:0,pb:1,qb:2,Jb:3,Ob:4,Lb:5,Mb:6,Kb:7,Ib:8,Nb:9,PROXY:10,NOPROXY:11,Gb:12,Cb:13,Db:14,Bb:15,Eb:16,Fb:17,ib:18,hb:19,jb:20},Sn.NO_ERROR=0,Sn.TIMEOUT=8,Sn.HTTP_ERROR=6,Kn=Sn,Vi.COMPLETE="complete",Ta=Vi,Ii.EventType=Fe,Fe.OPEN="a",Fe.CLOSE="b",Fe.ERROR="c",Fe.MESSAGE="d",dt.prototype.listen=dt.prototype.K,Xe=Ii,J.prototype.listenOnce=J.prototype.L,J.prototype.getLastError=J.prototype.Ka,J.prototype.getLastErrorCode=J.prototype.Ba,J.prototype.getStatus=J.prototype.Z,J.prototype.getResponseJson=J.prototype.Oa,J.prototype.getResponseText=J.prototype.oa,J.prototype.send=J.prototype.ea,J.prototype.setWithCredentials=J.prototype.Ha,va=J}).apply(typeof jn<"u"?jn:typeof self<"u"?self:typeof window<"u"?window:{});const wo="@firebase/firestore";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gt{constructor(t){this.uid=t}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(t){return t.uid===this.uid}}gt.UNAUTHENTICATED=new gt(null),gt.GOOGLE_CREDENTIALS=new gt("google-credentials-uid"),gt.FIRST_PARTY=new gt("first-party-uid"),gt.MOCK_USER=new gt("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ce="10.14.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ae=new pa("@firebase/firestore");function Ye(){return ae.logLevel}function k(n,...t){if(ae.logLevel<=q.DEBUG){const e=t.map(Rs);ae.debug(`Firestore (${Ce}): ${n}`,...e)}}function Ft(n,...t){if(ae.logLevel<=q.ERROR){const e=t.map(Rs);ae.error(`Firestore (${Ce}): ${n}`,...e)}}function Te(n,...t){if(ae.logLevel<=q.WARN){const e=t.map(Rs);ae.warn(`Firestore (${Ce}): ${n}`,...e)}}function Rs(n){if(typeof n=="string")return n;try{/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/return function(e){return JSON.stringify(e)}(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function x(n="Unexpected state"){const t=`FIRESTORE (${Ce}) INTERNAL ASSERTION FAILED: `+n;throw Ft(t),new Error(t)}function G(n,t){n||x()}function F(n,t){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class N extends Se{constructor(t,e){super(t,e),this.code=t,this.message=e,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xt{constructor(){this.promise=new Promise((t,e)=>{this.resolve=t,this.reject=e})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ra{constructor(t,e){this.user=e,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${t}`)}}class Jc{getToken(){return Promise.resolve(null)}invalidateToken(){}start(t,e){t.enqueueRetryable(()=>e(gt.UNAUTHENTICATED))}shutdown(){}}class Zc{constructor(t){this.token=t,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(t,e){this.changeListener=e,t.enqueueRetryable(()=>e(this.token.user))}shutdown(){this.changeListener=null}}class th{constructor(t){this.t=t,this.currentUser=gt.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(t,e){G(this.o===void 0);let r=this.i;const i=h=>this.i!==r?(r=this.i,e(h)):Promise.resolve();let o=new xt;this.o=()=>{this.i++,this.currentUser=this.u(),o.resolve(),o=new xt,t.enqueueRetryable(()=>i(this.currentUser))};const a=()=>{const h=o;t.enqueueRetryable(async()=>{await h.promise,await i(this.currentUser)})},c=h=>{k("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=h,this.o&&(this.auth.addAuthTokenListener(this.o),a())};this.t.onInit(h=>c(h)),setTimeout(()=>{if(!this.auth){const h=this.t.getImmediate({optional:!0});h?c(h):(k("FirebaseAuthCredentialsProvider","Auth not yet detected"),o.resolve(),o=new xt)}},0),a()}getToken(){const t=this.i,e=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(e).then(r=>this.i!==t?(k("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(G(typeof r.accessToken=="string"),new Ra(r.accessToken,this.currentUser)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const t=this.auth&&this.auth.getUid();return G(t===null||typeof t=="string"),new gt(t)}}class eh{constructor(t,e,r){this.l=t,this.h=e,this.P=r,this.type="FirstParty",this.user=gt.FIRST_PARTY,this.I=new Map}T(){return this.P?this.P():null}get headers(){this.I.set("X-Goog-AuthUser",this.l);const t=this.T();return t&&this.I.set("Authorization",t),this.h&&this.I.set("X-Goog-Iam-Authorization-Token",this.h),this.I}}class nh{constructor(t,e,r){this.l=t,this.h=e,this.P=r}getToken(){return Promise.resolve(new eh(this.l,this.h,this.P))}start(t,e){t.enqueueRetryable(()=>e(gt.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class rh{constructor(t){this.value=t,this.type="AppCheck",this.headers=new Map,t&&t.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class sh{constructor(t){this.A=t,this.forceRefresh=!1,this.appCheck=null,this.R=null}start(t,e){G(this.o===void 0);const r=o=>{o.error!=null&&k("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${o.error.message}`);const a=o.token!==this.R;return this.R=o.token,k("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?e(o.token):Promise.resolve()};this.o=o=>{t.enqueueRetryable(()=>r(o))};const i=o=>{k("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=o,this.o&&this.appCheck.addTokenListener(this.o)};this.A.onInit(o=>i(o)),setTimeout(()=>{if(!this.appCheck){const o=this.A.getImmediate({optional:!0});o?i(o):k("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}},0)}getToken(){const t=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(t).then(e=>e?(G(typeof e.token=="string"),this.R=e.token,new rh(e.token)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ih(n){const t=typeof self<"u"&&(self.crypto||self.msCrypto),e=new Uint8Array(n);if(t&&typeof t.getRandomValues=="function")t.getRandomValues(e);else for(let r=0;r<n;r++)e[r]=Math.floor(256*Math.random());return e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pa{static newId(){const t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",e=Math.floor(256/t.length)*t.length;let r="";for(;r.length<20;){const i=ih(40);for(let o=0;o<i.length;++o)r.length<20&&i[o]<e&&(r+=t.charAt(i[o]%t.length))}return r}}function $(n,t){return n<t?-1:n>t?1:0}function Ie(n,t,e){return n.length===t.length&&n.every((r,i)=>e(r,t[i]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nt{constructor(t,e){if(this.seconds=t,this.nanoseconds=e,e<0)throw new N(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(e>=1e9)throw new N(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(t<-62135596800)throw new N(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t);if(t>=253402300800)throw new N(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t)}static now(){return nt.fromMillis(Date.now())}static fromDate(t){return nt.fromMillis(t.getTime())}static fromMillis(t){const e=Math.floor(t/1e3),r=Math.floor(1e6*(t-1e3*e));return new nt(e,r)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/1e6}_compareTo(t){return this.seconds===t.seconds?$(this.nanoseconds,t.nanoseconds):$(this.seconds,t.seconds)}isEqual(t){return t.seconds===this.seconds&&t.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{seconds:this.seconds,nanoseconds:this.nanoseconds}}valueOf(){const t=this.seconds- -62135596800;return String(t).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class L{constructor(t){this.timestamp=t}static fromTimestamp(t){return new L(t)}static min(){return new L(new nt(0,0))}static max(){return new L(new nt(253402300799,999999999))}compareTo(t){return this.timestamp._compareTo(t.timestamp)}isEqual(t){return this.timestamp.isEqual(t.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ln{constructor(t,e,r){e===void 0?e=0:e>t.length&&x(),r===void 0?r=t.length-e:r>t.length-e&&x(),this.segments=t,this.offset=e,this.len=r}get length(){return this.len}isEqual(t){return ln.comparator(this,t)===0}child(t){const e=this.segments.slice(this.offset,this.limit());return t instanceof ln?t.forEach(r=>{e.push(r)}):e.push(t),this.construct(e)}limit(){return this.offset+this.length}popFirst(t){return t=t===void 0?1:t,this.construct(this.segments,this.offset+t,this.length-t)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(t){return this.segments[this.offset+t]}isEmpty(){return this.length===0}isPrefixOf(t){if(t.length<this.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}isImmediateParentOf(t){if(this.length+1!==t.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}forEach(t){for(let e=this.offset,r=this.limit();e<r;e++)t(this.segments[e])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(t,e){const r=Math.min(t.length,e.length);for(let i=0;i<r;i++){const o=t.get(i),a=e.get(i);if(o<a)return-1;if(o>a)return 1}return t.length<e.length?-1:t.length>e.length?1:0}}class Y extends ln{construct(t,e,r){return new Y(t,e,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...t){const e=[];for(const r of t){if(r.indexOf("//")>=0)throw new N(P.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);e.push(...r.split("/").filter(i=>i.length>0))}return new Y(e)}static emptyPath(){return new Y([])}}const oh=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class ut extends ln{construct(t,e,r){return new ut(t,e,r)}static isValidIdentifier(t){return oh.test(t)}canonicalString(){return this.toArray().map(t=>(t=t.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),ut.isValidIdentifier(t)||(t="`"+t+"`"),t)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)==="__name__"}static keyField(){return new ut(["__name__"])}static fromServerFormat(t){const e=[];let r="",i=0;const o=()=>{if(r.length===0)throw new N(P.INVALID_ARGUMENT,`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);e.push(r),r=""};let a=!1;for(;i<t.length;){const c=t[i];if(c==="\\"){if(i+1===t.length)throw new N(P.INVALID_ARGUMENT,"Path has trailing escape character: "+t);const h=t[i+1];if(h!=="\\"&&h!=="."&&h!=="`")throw new N(P.INVALID_ARGUMENT,"Path has invalid escape sequence: "+t);r+=h,i+=2}else c==="`"?(a=!a,i++):c!=="."||a?(r+=c,i++):(o(),i++)}if(o(),a)throw new N(P.INVALID_ARGUMENT,"Unterminated ` in path: "+t);return new ut(e)}static emptyPath(){return new ut([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class O{constructor(t){this.path=t}static fromPath(t){return new O(Y.fromString(t))}static fromName(t){return new O(Y.fromString(t).popFirst(5))}static empty(){return new O(Y.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(t){return this.path.length>=2&&this.path.get(this.path.length-2)===t}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(t){return t!==null&&Y.comparator(this.path,t.path)===0}toString(){return this.path.toString()}static comparator(t,e){return Y.comparator(t.path,e.path)}static isDocumentKey(t){return t.length%2==0}static fromSegments(t){return new O(new Y(t.slice()))}}function ah(n,t){const e=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=L.fromTimestamp(r===1e9?new nt(e+1,0):new nt(e,r));return new Qt(i,O.empty(),t)}function uh(n){return new Qt(n.readTime,n.key,-1)}class Qt{constructor(t,e,r){this.readTime=t,this.documentKey=e,this.largestBatchId=r}static min(){return new Qt(L.min(),O.empty(),-1)}static max(){return new Qt(L.max(),O.empty(),-1)}}function lh(n,t){let e=n.readTime.compareTo(t.readTime);return e!==0?e:(e=O.comparator(n.documentKey,t.documentKey),e!==0?e:$(n.largestBatchId,t.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ch="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class hh{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(t){this.onCommittedListeners.push(t)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach(t=>t())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function gn(n){if(n.code!==P.FAILED_PRECONDITION||n.message!==ch)throw n;k("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class S{constructor(t){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,t(e=>{this.isDone=!0,this.result=e,this.nextCallback&&this.nextCallback(e)},e=>{this.isDone=!0,this.error=e,this.catchCallback&&this.catchCallback(e)})}catch(t){return this.next(void 0,t)}next(t,e){return this.callbackAttached&&x(),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(e,this.error):this.wrapSuccess(t,this.result):new S((r,i)=>{this.nextCallback=o=>{this.wrapSuccess(t,o).next(r,i)},this.catchCallback=o=>{this.wrapFailure(e,o).next(r,i)}})}toPromise(){return new Promise((t,e)=>{this.next(t,e)})}wrapUserFunction(t){try{const e=t();return e instanceof S?e:S.resolve(e)}catch(e){return S.reject(e)}}wrapSuccess(t,e){return t?this.wrapUserFunction(()=>t(e)):S.resolve(e)}wrapFailure(t,e){return t?this.wrapUserFunction(()=>t(e)):S.reject(e)}static resolve(t){return new S((e,r)=>{e(t)})}static reject(t){return new S((e,r)=>{r(t)})}static waitFor(t){return new S((e,r)=>{let i=0,o=0,a=!1;t.forEach(c=>{++i,c.next(()=>{++o,a&&o===i&&e()},h=>r(h))}),a=!0,o===i&&e()})}static or(t){let e=S.resolve(!1);for(const r of t)e=e.next(i=>i?S.resolve(i):r());return e}static forEach(t,e){const r=[];return t.forEach((i,o)=>{r.push(e.call(this,i,o))}),this.waitFor(r)}static mapArray(t,e){return new S((r,i)=>{const o=t.length,a=new Array(o);let c=0;for(let h=0;h<o;h++){const f=h;e(t[f]).next(p=>{a[f]=p,++c,c===o&&r(a)},p=>i(p))}})}static doWhile(t,e){return new S((r,i)=>{const o=()=>{t()===!0?e().next(()=>{o()},i):r()};o()})}}function dh(n){const t=n.match(/Android ([\d.]+)/i),e=t?t[1].split(".").slice(0,2).join("."):"-1";return Number(e)}function _n(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ps{constructor(t,e){this.previousValue=t,e&&(e.sequenceNumberHandler=r=>this.ie(r),this.se=r=>e.writeSequenceNumber(r))}ie(t){return this.previousValue=Math.max(t,this.previousValue),this.previousValue}next(){const t=++this.previousValue;return this.se&&this.se(t),t}}Ps.oe=-1;function ur(n){return n==null}function Zn(n){return n===0&&1/n==-1/0}function fh(n){return typeof n=="number"&&Number.isInteger(n)&&!Zn(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ro(n){let t=0;for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t++;return t}function ce(n,t){for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t(e,n[e])}function Va(n){for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class X{constructor(t,e){this.comparator=t,this.root=e||at.EMPTY}insert(t,e){return new X(this.comparator,this.root.insert(t,e,this.comparator).copy(null,null,at.BLACK,null,null))}remove(t){return new X(this.comparator,this.root.remove(t,this.comparator).copy(null,null,at.BLACK,null,null))}get(t){let e=this.root;for(;!e.isEmpty();){const r=this.comparator(t,e.key);if(r===0)return e.value;r<0?e=e.left:r>0&&(e=e.right)}return null}indexOf(t){let e=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(t,r.key);if(i===0)return e+r.left.size;i<0?r=r.left:(e+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(t){return this.root.inorderTraversal(t)}forEach(t){this.inorderTraversal((e,r)=>(t(e,r),!1))}toString(){const t=[];return this.inorderTraversal((e,r)=>(t.push(`${e}:${r}`),!1)),`{${t.join(", ")}}`}reverseTraversal(t){return this.root.reverseTraversal(t)}getIterator(){return new $n(this.root,null,this.comparator,!1)}getIteratorFrom(t){return new $n(this.root,t,this.comparator,!1)}getReverseIterator(){return new $n(this.root,null,this.comparator,!0)}getReverseIteratorFrom(t){return new $n(this.root,t,this.comparator,!0)}}class $n{constructor(t,e,r,i){this.isReverse=i,this.nodeStack=[];let o=1;for(;!t.isEmpty();)if(o=e?r(t.key,e):1,e&&i&&(o*=-1),o<0)t=this.isReverse?t.left:t.right;else{if(o===0){this.nodeStack.push(t);break}this.nodeStack.push(t),t=this.isReverse?t.right:t.left}}getNext(){let t=this.nodeStack.pop();const e={key:t.key,value:t.value};if(this.isReverse)for(t=t.left;!t.isEmpty();)this.nodeStack.push(t),t=t.right;else for(t=t.right;!t.isEmpty();)this.nodeStack.push(t),t=t.left;return e}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const t=this.nodeStack[this.nodeStack.length-1];return{key:t.key,value:t.value}}}class at{constructor(t,e,r,i,o){this.key=t,this.value=e,this.color=r??at.RED,this.left=i??at.EMPTY,this.right=o??at.EMPTY,this.size=this.left.size+1+this.right.size}copy(t,e,r,i,o){return new at(t??this.key,e??this.value,r??this.color,i??this.left,o??this.right)}isEmpty(){return!1}inorderTraversal(t){return this.left.inorderTraversal(t)||t(this.key,this.value)||this.right.inorderTraversal(t)}reverseTraversal(t){return this.right.reverseTraversal(t)||t(this.key,this.value)||this.left.reverseTraversal(t)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(t,e,r){let i=this;const o=r(t,i.key);return i=o<0?i.copy(null,null,null,i.left.insert(t,e,r),null):o===0?i.copy(null,e,null,null,null):i.copy(null,null,null,null,i.right.insert(t,e,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return at.EMPTY;let t=this;return t.left.isRed()||t.left.left.isRed()||(t=t.moveRedLeft()),t=t.copy(null,null,null,t.left.removeMin(),null),t.fixUp()}remove(t,e){let r,i=this;if(e(t,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(t,e),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),e(t,i.key)===0){if(i.right.isEmpty())return at.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(t,e))}return i.fixUp()}isRed(){return this.color}fixUp(){let t=this;return t.right.isRed()&&!t.left.isRed()&&(t=t.rotateLeft()),t.left.isRed()&&t.left.left.isRed()&&(t=t.rotateRight()),t.left.isRed()&&t.right.isRed()&&(t=t.colorFlip()),t}moveRedLeft(){let t=this.colorFlip();return t.right.left.isRed()&&(t=t.copy(null,null,null,null,t.right.rotateRight()),t=t.rotateLeft(),t=t.colorFlip()),t}moveRedRight(){let t=this.colorFlip();return t.left.left.isRed()&&(t=t.rotateRight(),t=t.colorFlip()),t}rotateLeft(){const t=this.copy(null,null,at.RED,null,this.right.left);return this.right.copy(null,null,this.color,t,null)}rotateRight(){const t=this.copy(null,null,at.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,t)}colorFlip(){const t=this.left.copy(null,null,!this.left.color,null,null),e=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,t,e)}checkMaxDepth(){const t=this.check();return Math.pow(2,t)<=this.size+1}check(){if(this.isRed()&&this.left.isRed()||this.right.isRed())throw x();const t=this.left.check();if(t!==this.right.check())throw x();return t+(this.isRed()?0:1)}}at.EMPTY=null,at.RED=!0,at.BLACK=!1;at.EMPTY=new class{constructor(){this.size=0}get key(){throw x()}get value(){throw x()}get color(){throw x()}get left(){throw x()}get right(){throw x()}copy(t,e,r,i,o){return this}insert(t,e,r){return new at(t,e)}remove(t,e){return this}isEmpty(){return!0}inorderTraversal(t){return!1}reverseTraversal(t){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lt{constructor(t){this.comparator=t,this.data=new X(this.comparator)}has(t){return this.data.get(t)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(t){return this.data.indexOf(t)}forEach(t){this.data.inorderTraversal((e,r)=>(t(e),!1))}forEachInRange(t,e){const r=this.data.getIteratorFrom(t[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,t[1])>=0)return;e(i.key)}}forEachWhile(t,e){let r;for(r=e!==void 0?this.data.getIteratorFrom(e):this.data.getIterator();r.hasNext();)if(!t(r.getNext().key))return}firstAfterOrEqual(t){const e=this.data.getIteratorFrom(t);return e.hasNext()?e.getNext().key:null}getIterator(){return new Po(this.data.getIterator())}getIteratorFrom(t){return new Po(this.data.getIteratorFrom(t))}add(t){return this.copy(this.data.remove(t).insert(t,!0))}delete(t){return this.has(t)?this.copy(this.data.remove(t)):this}isEmpty(){return this.data.isEmpty()}unionWith(t){let e=this;return e.size<t.size&&(e=t,t=this),t.forEach(r=>{e=e.add(r)}),e}isEqual(t){if(!(t instanceof lt)||this.size!==t.size)return!1;const e=this.data.getIterator(),r=t.data.getIterator();for(;e.hasNext();){const i=e.getNext().key,o=r.getNext().key;if(this.comparator(i,o)!==0)return!1}return!0}toArray(){const t=[];return this.forEach(e=>{t.push(e)}),t}toString(){const t=[];return this.forEach(e=>t.push(e)),"SortedSet("+t.toString()+")"}copy(t){const e=new lt(this.comparator);return e.data=t,e}}class Po{constructor(t){this.iter=t}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class At{constructor(t){this.fields=t,t.sort(ut.comparator)}static empty(){return new At([])}unionWith(t){let e=new lt(ut.comparator);for(const r of this.fields)e=e.add(r);for(const r of t)e=e.add(r);return new At(e.toArray())}covers(t){for(const e of this.fields)if(e.isPrefixOf(t))return!0;return!1}isEqual(t){return Ie(this.fields,t.fields,(e,r)=>e.isEqual(r))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sa extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ct{constructor(t){this.binaryString=t}static fromBase64String(t){const e=function(i){try{return atob(i)}catch(o){throw typeof DOMException<"u"&&o instanceof DOMException?new Sa("Invalid base64 string: "+o):o}}(t);return new ct(e)}static fromUint8Array(t){const e=function(i){let o="";for(let a=0;a<i.length;++a)o+=String.fromCharCode(i[a]);return o}(t);return new ct(e)}[Symbol.iterator](){let t=0;return{next:()=>t<this.binaryString.length?{value:this.binaryString.charCodeAt(t++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(e){return btoa(e)}(this.binaryString)}toUint8Array(){return function(e){const r=new Uint8Array(e.length);for(let i=0;i<e.length;i++)r[i]=e.charCodeAt(i);return r}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(t){return $(this.binaryString,t.binaryString)}isEqual(t){return this.binaryString===t.binaryString}}ct.EMPTY_BYTE_STRING=new ct("");const ph=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Ht(n){if(G(!!n),typeof n=="string"){let t=0;const e=ph.exec(n);if(G(!!e),e[1]){let i=e[1];i=(i+"000000000").substr(0,9),t=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:t}}return{seconds:Z(n.seconds),nanos:Z(n.nanos)}}function Z(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function ue(n){return typeof n=="string"?ct.fromBase64String(n):ct.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vs(n){var t,e;return((e=(((t=n?.mapValue)===null||t===void 0?void 0:t.fields)||{}).__type__)===null||e===void 0?void 0:e.stringValue)==="server_timestamp"}function Ss(n){const t=n.mapValue.fields.__previous_value__;return Vs(t)?Ss(t):t}function cn(n){const t=Ht(n.mapValue.fields.__local_write_time__.timestampValue);return new nt(t.seconds,t.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mh{constructor(t,e,r,i,o,a,c,h,f){this.databaseId=t,this.appId=e,this.persistenceKey=r,this.host=i,this.ssl=o,this.forceLongPolling=a,this.autoDetectLongPolling=c,this.longPollingOptions=h,this.useFetchStreams=f}}class hn{constructor(t,e){this.projectId=t,this.database=e||"(default)"}static empty(){return new hn("","")}get isDefaultDatabase(){return this.database==="(default)"}isEqual(t){return t instanceof hn&&t.projectId===this.projectId&&t.database===this.database}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zn={mapValue:{}};function le(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?Vs(n)?4:_h(n)?9007199254740991:gh(n)?10:11:x()}function Dt(n,t){if(n===t)return!0;const e=le(n);if(e!==le(t))return!1;switch(e){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===t.booleanValue;case 4:return cn(n).isEqual(cn(t));case 3:return function(i,o){if(typeof i.timestampValue=="string"&&typeof o.timestampValue=="string"&&i.timestampValue.length===o.timestampValue.length)return i.timestampValue===o.timestampValue;const a=Ht(i.timestampValue),c=Ht(o.timestampValue);return a.seconds===c.seconds&&a.nanos===c.nanos}(n,t);case 5:return n.stringValue===t.stringValue;case 6:return function(i,o){return ue(i.bytesValue).isEqual(ue(o.bytesValue))}(n,t);case 7:return n.referenceValue===t.referenceValue;case 8:return function(i,o){return Z(i.geoPointValue.latitude)===Z(o.geoPointValue.latitude)&&Z(i.geoPointValue.longitude)===Z(o.geoPointValue.longitude)}(n,t);case 2:return function(i,o){if("integerValue"in i&&"integerValue"in o)return Z(i.integerValue)===Z(o.integerValue);if("doubleValue"in i&&"doubleValue"in o){const a=Z(i.doubleValue),c=Z(o.doubleValue);return a===c?Zn(a)===Zn(c):isNaN(a)&&isNaN(c)}return!1}(n,t);case 9:return Ie(n.arrayValue.values||[],t.arrayValue.values||[],Dt);case 10:case 11:return function(i,o){const a=i.mapValue.fields||{},c=o.mapValue.fields||{};if(Ro(a)!==Ro(c))return!1;for(const h in a)if(a.hasOwnProperty(h)&&(c[h]===void 0||!Dt(a[h],c[h])))return!1;return!0}(n,t);default:return x()}}function dn(n,t){return(n.values||[]).find(e=>Dt(e,t))!==void 0}function Ae(n,t){if(n===t)return 0;const e=le(n),r=le(t);if(e!==r)return $(e,r);switch(e){case 0:case 9007199254740991:return 0;case 1:return $(n.booleanValue,t.booleanValue);case 2:return function(o,a){const c=Z(o.integerValue||o.doubleValue),h=Z(a.integerValue||a.doubleValue);return c<h?-1:c>h?1:c===h?0:isNaN(c)?isNaN(h)?0:-1:1}(n,t);case 3:return Vo(n.timestampValue,t.timestampValue);case 4:return Vo(cn(n),cn(t));case 5:return $(n.stringValue,t.stringValue);case 6:return function(o,a){const c=ue(o),h=ue(a);return c.compareTo(h)}(n.bytesValue,t.bytesValue);case 7:return function(o,a){const c=o.split("/"),h=a.split("/");for(let f=0;f<c.length&&f<h.length;f++){const p=$(c[f],h[f]);if(p!==0)return p}return $(c.length,h.length)}(n.referenceValue,t.referenceValue);case 8:return function(o,a){const c=$(Z(o.latitude),Z(a.latitude));return c!==0?c:$(Z(o.longitude),Z(a.longitude))}(n.geoPointValue,t.geoPointValue);case 9:return So(n.arrayValue,t.arrayValue);case 10:return function(o,a){var c,h,f,p;const I=o.fields||{},w=a.fields||{},V=(c=I.value)===null||c===void 0?void 0:c.arrayValue,D=(h=w.value)===null||h===void 0?void 0:h.arrayValue,M=$(((f=V?.values)===null||f===void 0?void 0:f.length)||0,((p=D?.values)===null||p===void 0?void 0:p.length)||0);return M!==0?M:So(V,D)}(n.mapValue,t.mapValue);case 11:return function(o,a){if(o===zn.mapValue&&a===zn.mapValue)return 0;if(o===zn.mapValue)return 1;if(a===zn.mapValue)return-1;const c=o.fields||{},h=Object.keys(c),f=a.fields||{},p=Object.keys(f);h.sort(),p.sort();for(let I=0;I<h.length&&I<p.length;++I){const w=$(h[I],p[I]);if(w!==0)return w;const V=Ae(c[h[I]],f[p[I]]);if(V!==0)return V}return $(h.length,p.length)}(n.mapValue,t.mapValue);default:throw x()}}function Vo(n,t){if(typeof n=="string"&&typeof t=="string"&&n.length===t.length)return $(n,t);const e=Ht(n),r=Ht(t),i=$(e.seconds,r.seconds);return i!==0?i:$(e.nanos,r.nanos)}function So(n,t){const e=n.values||[],r=t.values||[];for(let i=0;i<e.length&&i<r.length;++i){const o=Ae(e[i],r[i]);if(o)return o}return $(e.length,r.length)}function we(n){return us(n)}function us(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?function(e){const r=Ht(e);return`time(${r.seconds},${r.nanos})`}(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?function(e){return ue(e).toBase64()}(n.bytesValue):"referenceValue"in n?function(e){return O.fromName(e).toString()}(n.referenceValue):"geoPointValue"in n?function(e){return`geo(${e.latitude},${e.longitude})`}(n.geoPointValue):"arrayValue"in n?function(e){let r="[",i=!0;for(const o of e.values||[])i?i=!1:r+=",",r+=us(o);return r+"]"}(n.arrayValue):"mapValue"in n?function(e){const r=Object.keys(e.fields||{}).sort();let i="{",o=!0;for(const a of r)o?o=!1:i+=",",i+=`${a}:${us(e.fields[a])}`;return i+"}"}(n.mapValue):x()}function Co(n,t){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${t.path.canonicalString()}`}}function ls(n){return!!n&&"integerValue"in n}function Cs(n){return!!n&&"arrayValue"in n}function bo(n){return!!n&&"nullValue"in n}function Do(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function Wn(n){return!!n&&"mapValue"in n}function gh(n){var t,e;return((e=(((t=n?.mapValue)===null||t===void 0?void 0:t.fields)||{}).__type__)===null||e===void 0?void 0:e.stringValue)==="__vector__"}function en(n){if(n.geoPointValue)return{geoPointValue:Object.assign({},n.geoPointValue)};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:Object.assign({},n.timestampValue)};if(n.mapValue){const t={mapValue:{fields:{}}};return ce(n.mapValue.fields,(e,r)=>t.mapValue.fields[e]=en(r)),t}if(n.arrayValue){const t={arrayValue:{values:[]}};for(let e=0;e<(n.arrayValue.values||[]).length;++e)t.arrayValue.values[e]=en(n.arrayValue.values[e]);return t}return Object.assign({},n)}function _h(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue==="__max__"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tt{constructor(t){this.value=t}static empty(){return new Tt({mapValue:{}})}field(t){if(t.isEmpty())return this.value;{let e=this.value;for(let r=0;r<t.length-1;++r)if(e=(e.mapValue.fields||{})[t.get(r)],!Wn(e))return null;return e=(e.mapValue.fields||{})[t.lastSegment()],e||null}}set(t,e){this.getFieldsMap(t.popLast())[t.lastSegment()]=en(e)}setAll(t){let e=ut.emptyPath(),r={},i=[];t.forEach((a,c)=>{if(!e.isImmediateParentOf(c)){const h=this.getFieldsMap(e);this.applyChanges(h,r,i),r={},i=[],e=c.popLast()}a?r[c.lastSegment()]=en(a):i.push(c.lastSegment())});const o=this.getFieldsMap(e);this.applyChanges(o,r,i)}delete(t){const e=this.field(t.popLast());Wn(e)&&e.mapValue.fields&&delete e.mapValue.fields[t.lastSegment()]}isEqual(t){return Dt(this.value,t.value)}getFieldsMap(t){let e=this.value;e.mapValue.fields||(e.mapValue={fields:{}});for(let r=0;r<t.length;++r){let i=e.mapValue.fields[t.get(r)];Wn(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},e.mapValue.fields[t.get(r)]=i),e=i}return e.mapValue.fields}applyChanges(t,e,r){ce(e,(i,o)=>t[i]=o);for(const i of r)delete t[i]}clone(){return new Tt(en(this.value))}}function Ca(n){const t=[];return ce(n.fields,(e,r)=>{const i=new ut([e]);if(Wn(r)){const o=Ca(r.mapValue).fields;if(o.length===0)t.push(i);else for(const a of o)t.push(i.child(a))}else t.push(i)}),new At(t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _t{constructor(t,e,r,i,o,a,c){this.key=t,this.documentType=e,this.version=r,this.readTime=i,this.createTime=o,this.data=a,this.documentState=c}static newInvalidDocument(t){return new _t(t,0,L.min(),L.min(),L.min(),Tt.empty(),0)}static newFoundDocument(t,e,r,i){return new _t(t,1,e,L.min(),r,i,0)}static newNoDocument(t,e){return new _t(t,2,e,L.min(),L.min(),Tt.empty(),0)}static newUnknownDocument(t,e){return new _t(t,3,e,L.min(),L.min(),Tt.empty(),2)}convertToFoundDocument(t,e){return!this.createTime.isEqual(L.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=t),this.version=t,this.documentType=1,this.data=e,this.documentState=0,this}convertToNoDocument(t){return this.version=t,this.documentType=2,this.data=Tt.empty(),this.documentState=0,this}convertToUnknownDocument(t){return this.version=t,this.documentType=3,this.data=Tt.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=L.min(),this}setReadTime(t){return this.readTime=t,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(t){return t instanceof _t&&this.key.isEqual(t.key)&&this.version.isEqual(t.version)&&this.documentType===t.documentType&&this.documentState===t.documentState&&this.data.isEqual(t.data)}mutableCopy(){return new _t(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tr{constructor(t,e){this.position=t,this.inclusive=e}}function No(n,t,e){let r=0;for(let i=0;i<n.position.length;i++){const o=t[i],a=n.position[i];if(o.field.isKeyField()?r=O.comparator(O.fromName(a.referenceValue),e.key):r=Ae(a,e.data.field(o.field)),o.dir==="desc"&&(r*=-1),r!==0)break}return r}function ko(n,t){if(n===null)return t===null;if(t===null||n.inclusive!==t.inclusive||n.position.length!==t.position.length)return!1;for(let e=0;e<n.position.length;e++)if(!Dt(n.position[e],t.position[e]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fn{constructor(t,e="asc"){this.field=t,this.dir=e}}function yh(n,t){return n.dir===t.dir&&n.field.isEqual(t.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ba{}class et extends ba{constructor(t,e,r){super(),this.field=t,this.op=e,this.value=r}static create(t,e,r){return t.isKeyField()?e==="in"||e==="not-in"?this.createKeyFieldInFilter(t,e,r):new vh(t,e,r):e==="array-contains"?new Ah(t,r):e==="in"?new wh(t,r):e==="not-in"?new Rh(t,r):e==="array-contains-any"?new Ph(t,r):new et(t,e,r)}static createKeyFieldInFilter(t,e,r){return e==="in"?new Th(t,r):new Ih(t,r)}matches(t){const e=t.data.field(this.field);return this.op==="!="?e!==null&&this.matchesComparison(Ae(e,this.value)):e!==null&&le(this.value)===le(e)&&this.matchesComparison(Ae(e,this.value))}matchesComparison(t){switch(this.op){case"<":return t<0;case"<=":return t<=0;case"==":return t===0;case"!=":return t!==0;case">":return t>0;case">=":return t>=0;default:return x()}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class Vt extends ba{constructor(t,e){super(),this.filters=t,this.op=e,this.ae=null}static create(t,e){return new Vt(t,e)}matches(t){return Da(this)?this.filters.find(e=>!e.matches(t))===void 0:this.filters.find(e=>e.matches(t))!==void 0}getFlattenedFilters(){return this.ae!==null||(this.ae=this.filters.reduce((t,e)=>t.concat(e.getFlattenedFilters()),[])),this.ae}getFilters(){return Object.assign([],this.filters)}}function Da(n){return n.op==="and"}function Na(n){return Eh(n)&&Da(n)}function Eh(n){for(const t of n.filters)if(t instanceof Vt)return!1;return!0}function cs(n){if(n instanceof et)return n.field.canonicalString()+n.op.toString()+we(n.value);if(Na(n))return n.filters.map(t=>cs(t)).join(",");{const t=n.filters.map(e=>cs(e)).join(",");return`${n.op}(${t})`}}function ka(n,t){return n instanceof et?function(r,i){return i instanceof et&&r.op===i.op&&r.field.isEqual(i.field)&&Dt(r.value,i.value)}(n,t):n instanceof Vt?function(r,i){return i instanceof Vt&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce((o,a,c)=>o&&ka(a,i.filters[c]),!0):!1}(n,t):void x()}function Ma(n){return n instanceof et?function(e){return`${e.field.canonicalString()} ${e.op} ${we(e.value)}`}(n):n instanceof Vt?function(e){return e.op.toString()+" {"+e.getFilters().map(Ma).join(" ,")+"}"}(n):"Filter"}class vh extends et{constructor(t,e,r){super(t,e,r),this.key=O.fromName(r.referenceValue)}matches(t){const e=O.comparator(t.key,this.key);return this.matchesComparison(e)}}class Th extends et{constructor(t,e){super(t,"in",e),this.keys=Oa("in",e)}matches(t){return this.keys.some(e=>e.isEqual(t.key))}}class Ih extends et{constructor(t,e){super(t,"not-in",e),this.keys=Oa("not-in",e)}matches(t){return!this.keys.some(e=>e.isEqual(t.key))}}function Oa(n,t){var e;return(((e=t.arrayValue)===null||e===void 0?void 0:e.values)||[]).map(r=>O.fromName(r.referenceValue))}class Ah extends et{constructor(t,e){super(t,"array-contains",e)}matches(t){const e=t.data.field(this.field);return Cs(e)&&dn(e.arrayValue,this.value)}}class wh extends et{constructor(t,e){super(t,"in",e)}matches(t){const e=t.data.field(this.field);return e!==null&&dn(this.value.arrayValue,e)}}class Rh extends et{constructor(t,e){super(t,"not-in",e)}matches(t){if(dn(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const e=t.data.field(this.field);return e!==null&&!dn(this.value.arrayValue,e)}}class Ph extends et{constructor(t,e){super(t,"array-contains-any",e)}matches(t){const e=t.data.field(this.field);return!(!Cs(e)||!e.arrayValue.values)&&e.arrayValue.values.some(r=>dn(this.value.arrayValue,r))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vh{constructor(t,e=null,r=[],i=[],o=null,a=null,c=null){this.path=t,this.collectionGroup=e,this.orderBy=r,this.filters=i,this.limit=o,this.startAt=a,this.endAt=c,this.ue=null}}function Mo(n,t=null,e=[],r=[],i=null,o=null,a=null){return new Vh(n,t,e,r,i,o,a)}function bs(n){const t=F(n);if(t.ue===null){let e=t.path.canonicalString();t.collectionGroup!==null&&(e+="|cg:"+t.collectionGroup),e+="|f:",e+=t.filters.map(r=>cs(r)).join(","),e+="|ob:",e+=t.orderBy.map(r=>function(o){return o.field.canonicalString()+o.dir}(r)).join(","),ur(t.limit)||(e+="|l:",e+=t.limit),t.startAt&&(e+="|lb:",e+=t.startAt.inclusive?"b:":"a:",e+=t.startAt.position.map(r=>we(r)).join(",")),t.endAt&&(e+="|ub:",e+=t.endAt.inclusive?"a:":"b:",e+=t.endAt.position.map(r=>we(r)).join(",")),t.ue=e}return t.ue}function Ds(n,t){if(n.limit!==t.limit||n.orderBy.length!==t.orderBy.length)return!1;for(let e=0;e<n.orderBy.length;e++)if(!yh(n.orderBy[e],t.orderBy[e]))return!1;if(n.filters.length!==t.filters.length)return!1;for(let e=0;e<n.filters.length;e++)if(!ka(n.filters[e],t.filters[e]))return!1;return n.collectionGroup===t.collectionGroup&&!!n.path.isEqual(t.path)&&!!ko(n.startAt,t.startAt)&&ko(n.endAt,t.endAt)}function hs(n){return O.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class be{constructor(t,e=null,r=[],i=[],o=null,a="F",c=null,h=null){this.path=t,this.collectionGroup=e,this.explicitOrderBy=r,this.filters=i,this.limit=o,this.limitType=a,this.startAt=c,this.endAt=h,this.ce=null,this.le=null,this.he=null,this.startAt,this.endAt}}function Sh(n,t,e,r,i,o,a,c){return new be(n,t,e,r,i,o,a,c)}function lr(n){return new be(n)}function Oo(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function xa(n){return n.collectionGroup!==null}function nn(n){const t=F(n);if(t.ce===null){t.ce=[];const e=new Set;for(const o of t.explicitOrderBy)t.ce.push(o),e.add(o.field.canonicalString());const r=t.explicitOrderBy.length>0?t.explicitOrderBy[t.explicitOrderBy.length-1].dir:"asc";(function(a){let c=new lt(ut.comparator);return a.filters.forEach(h=>{h.getFlattenedFilters().forEach(f=>{f.isInequality()&&(c=c.add(f.field))})}),c})(t).forEach(o=>{e.has(o.canonicalString())||o.isKeyField()||t.ce.push(new fn(o,r))}),e.has(ut.keyField().canonicalString())||t.ce.push(new fn(ut.keyField(),r))}return t.ce}function St(n){const t=F(n);return t.le||(t.le=Ch(t,nn(n))),t.le}function Ch(n,t){if(n.limitType==="F")return Mo(n.path,n.collectionGroup,t,n.filters,n.limit,n.startAt,n.endAt);{t=t.map(i=>{const o=i.dir==="desc"?"asc":"desc";return new fn(i.field,o)});const e=n.endAt?new tr(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new tr(n.startAt.position,n.startAt.inclusive):null;return Mo(n.path,n.collectionGroup,t,n.filters,n.limit,e,r)}}function ds(n,t){const e=n.filters.concat([t]);return new be(n.path,n.collectionGroup,n.explicitOrderBy.slice(),e,n.limit,n.limitType,n.startAt,n.endAt)}function fs(n,t,e){return new be(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),t,e,n.startAt,n.endAt)}function cr(n,t){return Ds(St(n),St(t))&&n.limitType===t.limitType}function La(n){return`${bs(St(n))}|lt:${n.limitType}`}function ge(n){return`Query(target=${function(e){let r=e.path.canonicalString();return e.collectionGroup!==null&&(r+=" collectionGroup="+e.collectionGroup),e.filters.length>0&&(r+=`, filters: [${e.filters.map(i=>Ma(i)).join(", ")}]`),ur(e.limit)||(r+=", limit: "+e.limit),e.orderBy.length>0&&(r+=`, orderBy: [${e.orderBy.map(i=>function(a){return`${a.field.canonicalString()} (${a.dir})`}(i)).join(", ")}]`),e.startAt&&(r+=", startAt: ",r+=e.startAt.inclusive?"b:":"a:",r+=e.startAt.position.map(i=>we(i)).join(",")),e.endAt&&(r+=", endAt: ",r+=e.endAt.inclusive?"a:":"b:",r+=e.endAt.position.map(i=>we(i)).join(",")),`Target(${r})`}(St(n))}; limitType=${n.limitType})`}function hr(n,t){return t.isFoundDocument()&&function(r,i){const o=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(o):O.isDocumentKey(r.path)?r.path.isEqual(o):r.path.isImmediateParentOf(o)}(n,t)&&function(r,i){for(const o of nn(r))if(!o.field.isKeyField()&&i.data.field(o.field)===null)return!1;return!0}(n,t)&&function(r,i){for(const o of r.filters)if(!o.matches(i))return!1;return!0}(n,t)&&function(r,i){return!(r.startAt&&!function(a,c,h){const f=No(a,c,h);return a.inclusive?f<=0:f<0}(r.startAt,nn(r),i)||r.endAt&&!function(a,c,h){const f=No(a,c,h);return a.inclusive?f>=0:f>0}(r.endAt,nn(r),i))}(n,t)}function bh(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function Fa(n){return(t,e)=>{let r=!1;for(const i of nn(n)){const o=Dh(i,t,e);if(o!==0)return o;r=r||i.field.isKeyField()}return 0}}function Dh(n,t,e){const r=n.field.isKeyField()?O.comparator(t.key,e.key):function(o,a,c){const h=a.data.field(o),f=c.data.field(o);return h!==null&&f!==null?Ae(h,f):x()}(n.field,t,e);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return x()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class De{constructor(t,e){this.mapKeyFn=t,this.equalsFn=e,this.inner={},this.innerSize=0}get(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r!==void 0){for(const[i,o]of r)if(this.equalsFn(i,t))return o}}has(t){return this.get(t)!==void 0}set(t,e){const r=this.mapKeyFn(t),i=this.inner[r];if(i===void 0)return this.inner[r]=[[t,e]],void this.innerSize++;for(let o=0;o<i.length;o++)if(this.equalsFn(i[o][0],t))return void(i[o]=[t,e]);i.push([t,e]),this.innerSize++}delete(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],t))return r.length===1?delete this.inner[e]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(t){ce(this.inner,(e,r)=>{for(const[i,o]of r)t(i,o)})}isEmpty(){return Va(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nh=new X(O.comparator);function Ut(){return Nh}const Ua=new X(O.comparator);function Je(...n){let t=Ua;for(const e of n)t=t.insert(e.key,e);return t}function Ba(n){let t=Ua;return n.forEach((e,r)=>t=t.insert(e,r.overlayedDocument)),t}function ie(){return rn()}function qa(){return rn()}function rn(){return new De(n=>n.toString(),(n,t)=>n.isEqual(t))}const kh=new X(O.comparator),Mh=new lt(O.comparator);function U(...n){let t=Mh;for(const e of n)t=t.add(e);return t}const Oh=new lt($);function xh(){return Oh}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ns(n,t){if(n.useProto3Json){if(isNaN(t))return{doubleValue:"NaN"};if(t===1/0)return{doubleValue:"Infinity"};if(t===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:Zn(t)?"-0":t}}function ja(n){return{integerValue:""+n}}function Lh(n,t){return fh(t)?ja(t):Ns(n,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dr{constructor(){this._=void 0}}function Fh(n,t,e){return n instanceof er?function(i,o){const a={fields:{__type__:{stringValue:"server_timestamp"},__local_write_time__:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return o&&Vs(o)&&(o=Ss(o)),o&&(a.fields.__previous_value__=o),{mapValue:a}}(e,t):n instanceof pn?za(n,t):n instanceof mn?Ga(n,t):function(i,o){const a=$a(i,o),c=xo(a)+xo(i.Pe);return ls(a)&&ls(i.Pe)?ja(c):Ns(i.serializer,c)}(n,t)}function Uh(n,t,e){return n instanceof pn?za(n,t):n instanceof mn?Ga(n,t):e}function $a(n,t){return n instanceof nr?function(r){return ls(r)||function(o){return!!o&&"doubleValue"in o}(r)}(t)?t:{integerValue:0}:null}class er extends dr{}class pn extends dr{constructor(t){super(),this.elements=t}}function za(n,t){const e=Ka(t);for(const r of n.elements)e.some(i=>Dt(i,r))||e.push(r);return{arrayValue:{values:e}}}class mn extends dr{constructor(t){super(),this.elements=t}}function Ga(n,t){let e=Ka(t);for(const r of n.elements)e=e.filter(i=>!Dt(i,r));return{arrayValue:{values:e}}}class nr extends dr{constructor(t,e){super(),this.serializer=t,this.Pe=e}}function xo(n){return Z(n.integerValue||n.doubleValue)}function Ka(n){return Cs(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}function Bh(n,t){return n.field.isEqual(t.field)&&function(r,i){return r instanceof pn&&i instanceof pn||r instanceof mn&&i instanceof mn?Ie(r.elements,i.elements,Dt):r instanceof nr&&i instanceof nr?Dt(r.Pe,i.Pe):r instanceof er&&i instanceof er}(n.transform,t.transform)}class qh{constructor(t,e){this.version=t,this.transformResults=e}}class Pt{constructor(t,e){this.updateTime=t,this.exists=e}static none(){return new Pt}static exists(t){return new Pt(void 0,t)}static updateTime(t){return new Pt(t)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(t){return this.exists===t.exists&&(this.updateTime?!!t.updateTime&&this.updateTime.isEqual(t.updateTime):!t.updateTime)}}function Qn(n,t){return n.updateTime!==void 0?t.isFoundDocument()&&t.version.isEqual(n.updateTime):n.exists===void 0||n.exists===t.isFoundDocument()}class fr{}function Wa(n,t){if(!n.hasLocalMutations||t&&t.fields.length===0)return null;if(t===null)return n.isNoDocument()?new ks(n.key,Pt.none()):new yn(n.key,n.data,Pt.none());{const e=n.data,r=Tt.empty();let i=new lt(ut.comparator);for(let o of t.fields)if(!i.has(o)){let a=e.field(o);a===null&&o.length>1&&(o=o.popLast(),a=e.field(o)),a===null?r.delete(o):r.set(o,a),i=i.add(o)}return new Jt(n.key,r,new At(i.toArray()),Pt.none())}}function jh(n,t,e){n instanceof yn?function(i,o,a){const c=i.value.clone(),h=Fo(i.fieldTransforms,o,a.transformResults);c.setAll(h),o.convertToFoundDocument(a.version,c).setHasCommittedMutations()}(n,t,e):n instanceof Jt?function(i,o,a){if(!Qn(i.precondition,o))return void o.convertToUnknownDocument(a.version);const c=Fo(i.fieldTransforms,o,a.transformResults),h=o.data;h.setAll(Qa(i)),h.setAll(c),o.convertToFoundDocument(a.version,h).setHasCommittedMutations()}(n,t,e):function(i,o,a){o.convertToNoDocument(a.version).setHasCommittedMutations()}(0,t,e)}function sn(n,t,e,r){return n instanceof yn?function(o,a,c,h){if(!Qn(o.precondition,a))return c;const f=o.value.clone(),p=Uo(o.fieldTransforms,h,a);return f.setAll(p),a.convertToFoundDocument(a.version,f).setHasLocalMutations(),null}(n,t,e,r):n instanceof Jt?function(o,a,c,h){if(!Qn(o.precondition,a))return c;const f=Uo(o.fieldTransforms,h,a),p=a.data;return p.setAll(Qa(o)),p.setAll(f),a.convertToFoundDocument(a.version,p).setHasLocalMutations(),c===null?null:c.unionWith(o.fieldMask.fields).unionWith(o.fieldTransforms.map(I=>I.field))}(n,t,e,r):function(o,a,c){return Qn(o.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):c}(n,t,e)}function $h(n,t){let e=null;for(const r of n.fieldTransforms){const i=t.data.field(r.field),o=$a(r.transform,i||null);o!=null&&(e===null&&(e=Tt.empty()),e.set(r.field,o))}return e||null}function Lo(n,t){return n.type===t.type&&!!n.key.isEqual(t.key)&&!!n.precondition.isEqual(t.precondition)&&!!function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&Ie(r,i,(o,a)=>Bh(o,a))}(n.fieldTransforms,t.fieldTransforms)&&(n.type===0?n.value.isEqual(t.value):n.type!==1||n.data.isEqual(t.data)&&n.fieldMask.isEqual(t.fieldMask))}class yn extends fr{constructor(t,e,r,i=[]){super(),this.key=t,this.value=e,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class Jt extends fr{constructor(t,e,r,i,o=[]){super(),this.key=t,this.data=e,this.fieldMask=r,this.precondition=i,this.fieldTransforms=o,this.type=1}getFieldMask(){return this.fieldMask}}function Qa(n){const t=new Map;return n.fieldMask.fields.forEach(e=>{if(!e.isEmpty()){const r=n.data.field(e);t.set(e,r)}}),t}function Fo(n,t,e){const r=new Map;G(n.length===e.length);for(let i=0;i<e.length;i++){const o=n[i],a=o.transform,c=t.data.field(o.field);r.set(o.field,Uh(a,c,e[i]))}return r}function Uo(n,t,e){const r=new Map;for(const i of n){const o=i.transform,a=e.data.field(i.field);r.set(i.field,Fh(o,a,t))}return r}class ks extends fr{constructor(t,e){super(),this.key=t,this.precondition=e,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class zh extends fr{constructor(t,e){super(),this.key=t,this.precondition=e,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gh{constructor(t,e,r,i){this.batchId=t,this.localWriteTime=e,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(t,e){const r=e.mutationResults;for(let i=0;i<this.mutations.length;i++){const o=this.mutations[i];o.key.isEqual(t.key)&&jh(o,t,r[i])}}applyToLocalView(t,e){for(const r of this.baseMutations)r.key.isEqual(t.key)&&(e=sn(r,t,e,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(t.key)&&(e=sn(r,t,e,this.localWriteTime));return e}applyToLocalDocumentSet(t,e){const r=qa();return this.mutations.forEach(i=>{const o=t.get(i.key),a=o.overlayedDocument;let c=this.applyToLocalView(a,o.mutatedFields);c=e.has(i.key)?null:c;const h=Wa(a,c);h!==null&&r.set(i.key,h),a.isValidDocument()||a.convertToNoDocument(L.min())}),r}keys(){return this.mutations.reduce((t,e)=>t.add(e.key),U())}isEqual(t){return this.batchId===t.batchId&&Ie(this.mutations,t.mutations,(e,r)=>Lo(e,r))&&Ie(this.baseMutations,t.baseMutations,(e,r)=>Lo(e,r))}}class Ms{constructor(t,e,r,i){this.batch=t,this.commitVersion=e,this.mutationResults=r,this.docVersions=i}static from(t,e,r){G(t.mutations.length===r.length);let i=function(){return kh}();const o=t.mutations;for(let a=0;a<o.length;a++)i=i.insert(o[a].key,r[a].version);return new Ms(t,e,r,i)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kh{constructor(t,e){this.largestBatchId=t,this.mutation=e}getKey(){return this.mutation.key}isEqual(t){return t!==null&&this.mutation===t.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wh{constructor(t,e){this.count=t,this.unchangedNames=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var tt,B;function Qh(n){switch(n){default:return x();case P.CANCELLED:case P.UNKNOWN:case P.DEADLINE_EXCEEDED:case P.RESOURCE_EXHAUSTED:case P.INTERNAL:case P.UNAVAILABLE:case P.UNAUTHENTICATED:return!1;case P.INVALID_ARGUMENT:case P.NOT_FOUND:case P.ALREADY_EXISTS:case P.PERMISSION_DENIED:case P.FAILED_PRECONDITION:case P.ABORTED:case P.OUT_OF_RANGE:case P.UNIMPLEMENTED:case P.DATA_LOSS:return!0}}function Ha(n){if(n===void 0)return Ft("GRPC error has no .code"),P.UNKNOWN;switch(n){case tt.OK:return P.OK;case tt.CANCELLED:return P.CANCELLED;case tt.UNKNOWN:return P.UNKNOWN;case tt.DEADLINE_EXCEEDED:return P.DEADLINE_EXCEEDED;case tt.RESOURCE_EXHAUSTED:return P.RESOURCE_EXHAUSTED;case tt.INTERNAL:return P.INTERNAL;case tt.UNAVAILABLE:return P.UNAVAILABLE;case tt.UNAUTHENTICATED:return P.UNAUTHENTICATED;case tt.INVALID_ARGUMENT:return P.INVALID_ARGUMENT;case tt.NOT_FOUND:return P.NOT_FOUND;case tt.ALREADY_EXISTS:return P.ALREADY_EXISTS;case tt.PERMISSION_DENIED:return P.PERMISSION_DENIED;case tt.FAILED_PRECONDITION:return P.FAILED_PRECONDITION;case tt.ABORTED:return P.ABORTED;case tt.OUT_OF_RANGE:return P.OUT_OF_RANGE;case tt.UNIMPLEMENTED:return P.UNIMPLEMENTED;case tt.DATA_LOSS:return P.DATA_LOSS;default:return x()}}(B=tt||(tt={}))[B.OK=0]="OK",B[B.CANCELLED=1]="CANCELLED",B[B.UNKNOWN=2]="UNKNOWN",B[B.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",B[B.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",B[B.NOT_FOUND=5]="NOT_FOUND",B[B.ALREADY_EXISTS=6]="ALREADY_EXISTS",B[B.PERMISSION_DENIED=7]="PERMISSION_DENIED",B[B.UNAUTHENTICATED=16]="UNAUTHENTICATED",B[B.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",B[B.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",B[B.ABORTED=10]="ABORTED",B[B.OUT_OF_RANGE=11]="OUT_OF_RANGE",B[B.UNIMPLEMENTED=12]="UNIMPLEMENTED",B[B.INTERNAL=13]="INTERNAL",B[B.UNAVAILABLE=14]="UNAVAILABLE",B[B.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hh(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Yh=new oe([4294967295,4294967295],0);function Bo(n){const t=Hh().encode(n),e=new Ea;return e.update(t),new Uint8Array(e.digest())}function qo(n){const t=new DataView(n.buffer),e=t.getUint32(0,!0),r=t.getUint32(4,!0),i=t.getUint32(8,!0),o=t.getUint32(12,!0);return[new oe([e,r],0),new oe([i,o],0)]}class Os{constructor(t,e,r){if(this.bitmap=t,this.padding=e,this.hashCount=r,e<0||e>=8)throw new Ze(`Invalid padding: ${e}`);if(r<0)throw new Ze(`Invalid hash count: ${r}`);if(t.length>0&&this.hashCount===0)throw new Ze(`Invalid hash count: ${r}`);if(t.length===0&&e!==0)throw new Ze(`Invalid padding when bitmap length is 0: ${e}`);this.Ie=8*t.length-e,this.Te=oe.fromNumber(this.Ie)}Ee(t,e,r){let i=t.add(e.multiply(oe.fromNumber(r)));return i.compare(Yh)===1&&(i=new oe([i.getBits(0),i.getBits(1)],0)),i.modulo(this.Te).toNumber()}de(t){return(this.bitmap[Math.floor(t/8)]&1<<t%8)!=0}mightContain(t){if(this.Ie===0)return!1;const e=Bo(t),[r,i]=qo(e);for(let o=0;o<this.hashCount;o++){const a=this.Ee(r,i,o);if(!this.de(a))return!1}return!0}static create(t,e,r){const i=t%8==0?0:8-t%8,o=new Uint8Array(Math.ceil(t/8)),a=new Os(o,i,e);return r.forEach(c=>a.insert(c)),a}insert(t){if(this.Ie===0)return;const e=Bo(t),[r,i]=qo(e);for(let o=0;o<this.hashCount;o++){const a=this.Ee(r,i,o);this.Ae(a)}}Ae(t){const e=Math.floor(t/8),r=t%8;this.bitmap[e]|=1<<r}}class Ze extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pr{constructor(t,e,r,i,o){this.snapshotVersion=t,this.targetChanges=e,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=o}static createSynthesizedRemoteEventForCurrentChange(t,e,r){const i=new Map;return i.set(t,En.createSynthesizedTargetChangeForCurrentChange(t,e,r)),new pr(L.min(),i,new X($),Ut(),U())}}class En{constructor(t,e,r,i,o){this.resumeToken=t,this.current=e,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=o}static createSynthesizedTargetChangeForCurrentChange(t,e,r){return new En(r,e,U(),U(),U())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hn{constructor(t,e,r,i){this.Re=t,this.removedTargetIds=e,this.key=r,this.Ve=i}}class Ya{constructor(t,e){this.targetId=t,this.me=e}}class Xa{constructor(t,e,r=ct.EMPTY_BYTE_STRING,i=null){this.state=t,this.targetIds=e,this.resumeToken=r,this.cause=i}}class jo{constructor(){this.fe=0,this.ge=zo(),this.pe=ct.EMPTY_BYTE_STRING,this.ye=!1,this.we=!0}get current(){return this.ye}get resumeToken(){return this.pe}get Se(){return this.fe!==0}get be(){return this.we}De(t){t.approximateByteSize()>0&&(this.we=!0,this.pe=t)}ve(){let t=U(),e=U(),r=U();return this.ge.forEach((i,o)=>{switch(o){case 0:t=t.add(i);break;case 2:e=e.add(i);break;case 1:r=r.add(i);break;default:x()}}),new En(this.pe,this.ye,t,e,r)}Ce(){this.we=!1,this.ge=zo()}Fe(t,e){this.we=!0,this.ge=this.ge.insert(t,e)}Me(t){this.we=!0,this.ge=this.ge.remove(t)}xe(){this.fe+=1}Oe(){this.fe-=1,G(this.fe>=0)}Ne(){this.we=!0,this.ye=!0}}class Xh{constructor(t){this.Le=t,this.Be=new Map,this.ke=Ut(),this.qe=$o(),this.Qe=new X($)}Ke(t){for(const e of t.Re)t.Ve&&t.Ve.isFoundDocument()?this.$e(e,t.Ve):this.Ue(e,t.key,t.Ve);for(const e of t.removedTargetIds)this.Ue(e,t.key,t.Ve)}We(t){this.forEachTarget(t,e=>{const r=this.Ge(e);switch(t.state){case 0:this.ze(e)&&r.De(t.resumeToken);break;case 1:r.Oe(),r.Se||r.Ce(),r.De(t.resumeToken);break;case 2:r.Oe(),r.Se||this.removeTarget(e);break;case 3:this.ze(e)&&(r.Ne(),r.De(t.resumeToken));break;case 4:this.ze(e)&&(this.je(e),r.De(t.resumeToken));break;default:x()}})}forEachTarget(t,e){t.targetIds.length>0?t.targetIds.forEach(e):this.Be.forEach((r,i)=>{this.ze(i)&&e(i)})}He(t){const e=t.targetId,r=t.me.count,i=this.Je(e);if(i){const o=i.target;if(hs(o))if(r===0){const a=new O(o.path);this.Ue(e,a,_t.newNoDocument(a,L.min()))}else G(r===1);else{const a=this.Ye(e);if(a!==r){const c=this.Ze(t),h=c?this.Xe(c,t,a):1;if(h!==0){this.je(e);const f=h===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Qe=this.Qe.insert(e,f)}}}}}Ze(t){const e=t.me.unchangedNames;if(!e||!e.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:o=0}=e;let a,c;try{a=ue(r).toUint8Array()}catch(h){if(h instanceof Sa)return Te("Decoding the base64 bloom filter in existence filter failed ("+h.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw h}try{c=new Os(a,i,o)}catch(h){return Te(h instanceof Ze?"BloomFilter error: ":"Applying bloom filter failed: ",h),null}return c.Ie===0?null:c}Xe(t,e,r){return e.me.count===r-this.nt(t,e.targetId)?0:2}nt(t,e){const r=this.Le.getRemoteKeysForTarget(e);let i=0;return r.forEach(o=>{const a=this.Le.tt(),c=`projects/${a.projectId}/databases/${a.database}/documents/${o.path.canonicalString()}`;t.mightContain(c)||(this.Ue(e,o,null),i++)}),i}rt(t){const e=new Map;this.Be.forEach((o,a)=>{const c=this.Je(a);if(c){if(o.current&&hs(c.target)){const h=new O(c.target.path);this.ke.get(h)!==null||this.it(a,h)||this.Ue(a,h,_t.newNoDocument(h,t))}o.be&&(e.set(a,o.ve()),o.Ce())}});let r=U();this.qe.forEach((o,a)=>{let c=!0;a.forEachWhile(h=>{const f=this.Je(h);return!f||f.purpose==="TargetPurposeLimboResolution"||(c=!1,!1)}),c&&(r=r.add(o))}),this.ke.forEach((o,a)=>a.setReadTime(t));const i=new pr(t,e,this.Qe,this.ke,r);return this.ke=Ut(),this.qe=$o(),this.Qe=new X($),i}$e(t,e){if(!this.ze(t))return;const r=this.it(t,e.key)?2:0;this.Ge(t).Fe(e.key,r),this.ke=this.ke.insert(e.key,e),this.qe=this.qe.insert(e.key,this.st(e.key).add(t))}Ue(t,e,r){if(!this.ze(t))return;const i=this.Ge(t);this.it(t,e)?i.Fe(e,1):i.Me(e),this.qe=this.qe.insert(e,this.st(e).delete(t)),r&&(this.ke=this.ke.insert(e,r))}removeTarget(t){this.Be.delete(t)}Ye(t){const e=this.Ge(t).ve();return this.Le.getRemoteKeysForTarget(t).size+e.addedDocuments.size-e.removedDocuments.size}xe(t){this.Ge(t).xe()}Ge(t){let e=this.Be.get(t);return e||(e=new jo,this.Be.set(t,e)),e}st(t){let e=this.qe.get(t);return e||(e=new lt($),this.qe=this.qe.insert(t,e)),e}ze(t){const e=this.Je(t)!==null;return e||k("WatchChangeAggregator","Detected inactive target",t),e}Je(t){const e=this.Be.get(t);return e&&e.Se?null:this.Le.ot(t)}je(t){this.Be.set(t,new jo),this.Le.getRemoteKeysForTarget(t).forEach(e=>{this.Ue(t,e,null)})}it(t,e){return this.Le.getRemoteKeysForTarget(t).has(e)}}function $o(){return new X(O.comparator)}function zo(){return new X(O.comparator)}const Jh={asc:"ASCENDING",desc:"DESCENDING"},Zh={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},td={and:"AND",or:"OR"};class ed{constructor(t,e){this.databaseId=t,this.useProto3Json=e}}function ps(n,t){return n.useProto3Json||ur(t)?t:{value:t}}function rr(n,t){return n.useProto3Json?`${new Date(1e3*t.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+t.nanoseconds).slice(-9)}Z`:{seconds:""+t.seconds,nanos:t.nanoseconds}}function Ja(n,t){return n.useProto3Json?t.toBase64():t.toUint8Array()}function nd(n,t){return rr(n,t.toTimestamp())}function Ct(n){return G(!!n),L.fromTimestamp(function(e){const r=Ht(e);return new nt(r.seconds,r.nanos)}(n))}function xs(n,t){return ms(n,t).canonicalString()}function ms(n,t){const e=function(i){return new Y(["projects",i.projectId,"databases",i.database])}(n).child("documents");return t===void 0?e:e.child(t)}function Za(n){const t=Y.fromString(n);return G(su(t)),t}function gs(n,t){return xs(n.databaseId,t.path)}function Xr(n,t){const e=Za(t);if(e.get(1)!==n.databaseId.projectId)throw new N(P.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+e.get(1)+" vs "+n.databaseId.projectId);if(e.get(3)!==n.databaseId.database)throw new N(P.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+e.get(3)+" vs "+n.databaseId.database);return new O(eu(e))}function tu(n,t){return xs(n.databaseId,t)}function rd(n){const t=Za(n);return t.length===4?Y.emptyPath():eu(t)}function _s(n){return new Y(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function eu(n){return G(n.length>4&&n.get(4)==="documents"),n.popFirst(5)}function Go(n,t,e){return{name:gs(n,t),fields:e.value.mapValue.fields}}function sd(n,t){let e;if("targetChange"in t){t.targetChange;const r=function(f){return f==="NO_CHANGE"?0:f==="ADD"?1:f==="REMOVE"?2:f==="CURRENT"?3:f==="RESET"?4:x()}(t.targetChange.targetChangeType||"NO_CHANGE"),i=t.targetChange.targetIds||[],o=function(f,p){return f.useProto3Json?(G(p===void 0||typeof p=="string"),ct.fromBase64String(p||"")):(G(p===void 0||p instanceof Buffer||p instanceof Uint8Array),ct.fromUint8Array(p||new Uint8Array))}(n,t.targetChange.resumeToken),a=t.targetChange.cause,c=a&&function(f){const p=f.code===void 0?P.UNKNOWN:Ha(f.code);return new N(p,f.message||"")}(a);e=new Xa(r,i,o,c||null)}else if("documentChange"in t){t.documentChange;const r=t.documentChange;r.document,r.document.name,r.document.updateTime;const i=Xr(n,r.document.name),o=Ct(r.document.updateTime),a=r.document.createTime?Ct(r.document.createTime):L.min(),c=new Tt({mapValue:{fields:r.document.fields}}),h=_t.newFoundDocument(i,o,a,c),f=r.targetIds||[],p=r.removedTargetIds||[];e=new Hn(f,p,h.key,h)}else if("documentDelete"in t){t.documentDelete;const r=t.documentDelete;r.document;const i=Xr(n,r.document),o=r.readTime?Ct(r.readTime):L.min(),a=_t.newNoDocument(i,o),c=r.removedTargetIds||[];e=new Hn([],c,a.key,a)}else if("documentRemove"in t){t.documentRemove;const r=t.documentRemove;r.document;const i=Xr(n,r.document),o=r.removedTargetIds||[];e=new Hn([],o,i,null)}else{if(!("filter"in t))return x();{t.filter;const r=t.filter;r.targetId;const{count:i=0,unchangedNames:o}=r,a=new Wh(i,o),c=r.targetId;e=new Ya(c,a)}}return e}function id(n,t){let e;if(t instanceof yn)e={update:Go(n,t.key,t.value)};else if(t instanceof ks)e={delete:gs(n,t.key)};else if(t instanceof Jt)e={update:Go(n,t.key,t.data),updateMask:pd(t.fieldMask)};else{if(!(t instanceof zh))return x();e={verify:gs(n,t.key)}}return t.fieldTransforms.length>0&&(e.updateTransforms=t.fieldTransforms.map(r=>function(o,a){const c=a.transform;if(c instanceof er)return{fieldPath:a.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(c instanceof pn)return{fieldPath:a.field.canonicalString(),appendMissingElements:{values:c.elements}};if(c instanceof mn)return{fieldPath:a.field.canonicalString(),removeAllFromArray:{values:c.elements}};if(c instanceof nr)return{fieldPath:a.field.canonicalString(),increment:c.Pe};throw x()}(0,r))),t.precondition.isNone||(e.currentDocument=function(i,o){return o.updateTime!==void 0?{updateTime:nd(i,o.updateTime)}:o.exists!==void 0?{exists:o.exists}:x()}(n,t.precondition)),e}function od(n,t){return n&&n.length>0?(G(t!==void 0),n.map(e=>function(i,o){let a=i.updateTime?Ct(i.updateTime):Ct(o);return a.isEqual(L.min())&&(a=Ct(o)),new qh(a,i.transformResults||[])}(e,t))):[]}function ad(n,t){return{documents:[tu(n,t.path)]}}function ud(n,t){const e={structuredQuery:{}},r=t.path;let i;t.collectionGroup!==null?(i=r,e.structuredQuery.from=[{collectionId:t.collectionGroup,allDescendants:!0}]):(i=r.popLast(),e.structuredQuery.from=[{collectionId:r.lastSegment()}]),e.parent=tu(n,i);const o=function(f){if(f.length!==0)return ru(Vt.create(f,"and"))}(t.filters);o&&(e.structuredQuery.where=o);const a=function(f){if(f.length!==0)return f.map(p=>function(w){return{field:_e(w.field),direction:hd(w.dir)}}(p))}(t.orderBy);a&&(e.structuredQuery.orderBy=a);const c=ps(n,t.limit);return c!==null&&(e.structuredQuery.limit=c),t.startAt&&(e.structuredQuery.startAt=function(f){return{before:f.inclusive,values:f.position}}(t.startAt)),t.endAt&&(e.structuredQuery.endAt=function(f){return{before:!f.inclusive,values:f.position}}(t.endAt)),{_t:e,parent:i}}function ld(n){let t=rd(n.parent);const e=n.structuredQuery,r=e.from?e.from.length:0;let i=null;if(r>0){G(r===1);const p=e.from[0];p.allDescendants?i=p.collectionId:t=t.child(p.collectionId)}let o=[];e.where&&(o=function(I){const w=nu(I);return w instanceof Vt&&Na(w)?w.getFilters():[w]}(e.where));let a=[];e.orderBy&&(a=function(I){return I.map(w=>function(D){return new fn(ye(D.field),function(b){switch(b){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}}(D.direction))}(w))}(e.orderBy));let c=null;e.limit&&(c=function(I){let w;return w=typeof I=="object"?I.value:I,ur(w)?null:w}(e.limit));let h=null;e.startAt&&(h=function(I){const w=!!I.before,V=I.values||[];return new tr(V,w)}(e.startAt));let f=null;return e.endAt&&(f=function(I){const w=!I.before,V=I.values||[];return new tr(V,w)}(e.endAt)),Sh(t,i,a,o,c,"F",h,f)}function cd(n,t){const e=function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return x()}}(t.purpose);return e==null?null:{"goog-listen-tags":e}}function nu(n){return n.unaryFilter!==void 0?function(e){switch(e.unaryFilter.op){case"IS_NAN":const r=ye(e.unaryFilter.field);return et.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=ye(e.unaryFilter.field);return et.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const o=ye(e.unaryFilter.field);return et.create(o,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const a=ye(e.unaryFilter.field);return et.create(a,"!=",{nullValue:"NULL_VALUE"});default:return x()}}(n):n.fieldFilter!==void 0?function(e){return et.create(ye(e.fieldFilter.field),function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";default:return x()}}(e.fieldFilter.op),e.fieldFilter.value)}(n):n.compositeFilter!==void 0?function(e){return Vt.create(e.compositeFilter.filters.map(r=>nu(r)),function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return x()}}(e.compositeFilter.op))}(n):x()}function hd(n){return Jh[n]}function dd(n){return Zh[n]}function fd(n){return td[n]}function _e(n){return{fieldPath:n.canonicalString()}}function ye(n){return ut.fromServerFormat(n.fieldPath)}function ru(n){return n instanceof et?function(e){if(e.op==="=="){if(Do(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NAN"}};if(bo(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NULL"}}}else if(e.op==="!="){if(Do(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NOT_NAN"}};if(bo(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:_e(e.field),op:dd(e.op),value:e.value}}}(n):n instanceof Vt?function(e){const r=e.getFilters().map(i=>ru(i));return r.length===1?r[0]:{compositeFilter:{op:fd(e.op),filters:r}}}(n):x()}function pd(n){const t=[];return n.fields.forEach(e=>t.push(e.canonicalString())),{fieldPaths:t}}function su(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zt{constructor(t,e,r,i,o=L.min(),a=L.min(),c=ct.EMPTY_BYTE_STRING,h=null){this.target=t,this.targetId=e,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=o,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=c,this.expectedCount=h}withSequenceNumber(t){return new zt(this.target,this.targetId,this.purpose,t,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(t,e){return new zt(this.target,this.targetId,this.purpose,this.sequenceNumber,e,this.lastLimboFreeSnapshotVersion,t,null)}withExpectedCount(t){return new zt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,t)}withLastLimboFreeSnapshotVersion(t){return new zt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,t,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class md{constructor(t){this.ct=t}}function gd(n){const t=ld({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?fs(t,t.limit,"L"):t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _d{constructor(){this.un=new yd}addToCollectionParentIndex(t,e){return this.un.add(e),S.resolve()}getCollectionParents(t,e){return S.resolve(this.un.getEntries(e))}addFieldIndex(t,e){return S.resolve()}deleteFieldIndex(t,e){return S.resolve()}deleteAllFieldIndexes(t){return S.resolve()}createTargetIndexes(t,e){return S.resolve()}getDocumentsMatchingTarget(t,e){return S.resolve(null)}getIndexType(t,e){return S.resolve(0)}getFieldIndexes(t,e){return S.resolve([])}getNextCollectionGroupToUpdate(t){return S.resolve(null)}getMinOffset(t,e){return S.resolve(Qt.min())}getMinOffsetFromCollectionGroup(t,e){return S.resolve(Qt.min())}updateCollectionGroup(t,e,r){return S.resolve()}updateIndexEntries(t,e){return S.resolve()}}class yd{constructor(){this.index={}}add(t){const e=t.lastSegment(),r=t.popLast(),i=this.index[e]||new lt(Y.comparator),o=!i.has(r);return this.index[e]=i.add(r),o}has(t){const e=t.lastSegment(),r=t.popLast(),i=this.index[e];return i&&i.has(r)}getEntries(t){return(this.index[t]||new lt(Y.comparator)).toArray()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Re{constructor(t){this.Ln=t}next(){return this.Ln+=2,this.Ln}static Bn(){return new Re(0)}static kn(){return new Re(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ed{constructor(){this.changes=new De(t=>t.toString(),(t,e)=>t.isEqual(e)),this.changesApplied=!1}addEntry(t){this.assertNotApplied(),this.changes.set(t.key,t)}removeEntry(t,e){this.assertNotApplied(),this.changes.set(t,_t.newInvalidDocument(t).setReadTime(e))}getEntry(t,e){this.assertNotApplied();const r=this.changes.get(e);return r!==void 0?S.resolve(r):this.getFromCache(t,e)}getEntries(t,e){return this.getAllFromCache(t,e)}apply(t){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(t)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vd{constructor(t,e){this.overlayedDocument=t,this.mutatedFields=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Td{constructor(t,e,r,i){this.remoteDocumentCache=t,this.mutationQueue=e,this.documentOverlayCache=r,this.indexManager=i}getDocument(t,e){let r=null;return this.documentOverlayCache.getOverlay(t,e).next(i=>(r=i,this.remoteDocumentCache.getEntry(t,e))).next(i=>(r!==null&&sn(r.mutation,i,At.empty(),nt.now()),i))}getDocuments(t,e){return this.remoteDocumentCache.getEntries(t,e).next(r=>this.getLocalViewOfDocuments(t,r,U()).next(()=>r))}getLocalViewOfDocuments(t,e,r=U()){const i=ie();return this.populateOverlays(t,i,e).next(()=>this.computeViews(t,e,i,r).next(o=>{let a=Je();return o.forEach((c,h)=>{a=a.insert(c,h.overlayedDocument)}),a}))}getOverlayedDocuments(t,e){const r=ie();return this.populateOverlays(t,r,e).next(()=>this.computeViews(t,e,r,U()))}populateOverlays(t,e,r){const i=[];return r.forEach(o=>{e.has(o)||i.push(o)}),this.documentOverlayCache.getOverlays(t,i).next(o=>{o.forEach((a,c)=>{e.set(a,c)})})}computeViews(t,e,r,i){let o=Ut();const a=rn(),c=function(){return rn()}();return e.forEach((h,f)=>{const p=r.get(f.key);i.has(f.key)&&(p===void 0||p.mutation instanceof Jt)?o=o.insert(f.key,f):p!==void 0?(a.set(f.key,p.mutation.getFieldMask()),sn(p.mutation,f,p.mutation.getFieldMask(),nt.now())):a.set(f.key,At.empty())}),this.recalculateAndSaveOverlays(t,o).next(h=>(h.forEach((f,p)=>a.set(f,p)),e.forEach((f,p)=>{var I;return c.set(f,new vd(p,(I=a.get(f))!==null&&I!==void 0?I:null))}),c))}recalculateAndSaveOverlays(t,e){const r=rn();let i=new X((a,c)=>a-c),o=U();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(t,e).next(a=>{for(const c of a)c.keys().forEach(h=>{const f=e.get(h);if(f===null)return;let p=r.get(h)||At.empty();p=c.applyToLocalView(f,p),r.set(h,p);const I=(i.get(c.batchId)||U()).add(h);i=i.insert(c.batchId,I)})}).next(()=>{const a=[],c=i.getReverseIterator();for(;c.hasNext();){const h=c.getNext(),f=h.key,p=h.value,I=qa();p.forEach(w=>{if(!o.has(w)){const V=Wa(e.get(w),r.get(w));V!==null&&I.set(w,V),o=o.add(w)}}),a.push(this.documentOverlayCache.saveOverlays(t,f,I))}return S.waitFor(a)}).next(()=>r)}recalculateAndSaveOverlaysForDocumentKeys(t,e){return this.remoteDocumentCache.getEntries(t,e).next(r=>this.recalculateAndSaveOverlays(t,r))}getDocumentsMatchingQuery(t,e,r,i){return function(a){return O.isDocumentKey(a.path)&&a.collectionGroup===null&&a.filters.length===0}(e)?this.getDocumentsMatchingDocumentQuery(t,e.path):xa(e)?this.getDocumentsMatchingCollectionGroupQuery(t,e,r,i):this.getDocumentsMatchingCollectionQuery(t,e,r,i)}getNextDocuments(t,e,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(t,e,r,i).next(o=>{const a=i-o.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(t,e,r.largestBatchId,i-o.size):S.resolve(ie());let c=-1,h=o;return a.next(f=>S.forEach(f,(p,I)=>(c<I.largestBatchId&&(c=I.largestBatchId),o.get(p)?S.resolve():this.remoteDocumentCache.getEntry(t,p).next(w=>{h=h.insert(p,w)}))).next(()=>this.populateOverlays(t,f,o)).next(()=>this.computeViews(t,h,f,U())).next(p=>({batchId:c,changes:Ba(p)})))})}getDocumentsMatchingDocumentQuery(t,e){return this.getDocument(t,new O(e)).next(r=>{let i=Je();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i})}getDocumentsMatchingCollectionGroupQuery(t,e,r,i){const o=e.collectionGroup;let a=Je();return this.indexManager.getCollectionParents(t,o).next(c=>S.forEach(c,h=>{const f=function(I,w){return new be(w,null,I.explicitOrderBy.slice(),I.filters.slice(),I.limit,I.limitType,I.startAt,I.endAt)}(e,h.child(o));return this.getDocumentsMatchingCollectionQuery(t,f,r,i).next(p=>{p.forEach((I,w)=>{a=a.insert(I,w)})})}).next(()=>a))}getDocumentsMatchingCollectionQuery(t,e,r,i){let o;return this.documentOverlayCache.getOverlaysForCollection(t,e.path,r.largestBatchId).next(a=>(o=a,this.remoteDocumentCache.getDocumentsMatchingQuery(t,e,r,o,i))).next(a=>{o.forEach((h,f)=>{const p=f.getKey();a.get(p)===null&&(a=a.insert(p,_t.newInvalidDocument(p)))});let c=Je();return a.forEach((h,f)=>{const p=o.get(h);p!==void 0&&sn(p.mutation,f,At.empty(),nt.now()),hr(e,f)&&(c=c.insert(h,f))}),c})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Id{constructor(t){this.serializer=t,this.hr=new Map,this.Pr=new Map}getBundleMetadata(t,e){return S.resolve(this.hr.get(e))}saveBundleMetadata(t,e){return this.hr.set(e.id,function(i){return{id:i.id,version:i.version,createTime:Ct(i.createTime)}}(e)),S.resolve()}getNamedQuery(t,e){return S.resolve(this.Pr.get(e))}saveNamedQuery(t,e){return this.Pr.set(e.name,function(i){return{name:i.name,query:gd(i.bundledQuery),readTime:Ct(i.readTime)}}(e)),S.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ad{constructor(){this.overlays=new X(O.comparator),this.Ir=new Map}getOverlay(t,e){return S.resolve(this.overlays.get(e))}getOverlays(t,e){const r=ie();return S.forEach(e,i=>this.getOverlay(t,i).next(o=>{o!==null&&r.set(i,o)})).next(()=>r)}saveOverlays(t,e,r){return r.forEach((i,o)=>{this.ht(t,e,o)}),S.resolve()}removeOverlaysForBatchId(t,e,r){const i=this.Ir.get(r);return i!==void 0&&(i.forEach(o=>this.overlays=this.overlays.remove(o)),this.Ir.delete(r)),S.resolve()}getOverlaysForCollection(t,e,r){const i=ie(),o=e.length+1,a=new O(e.child("")),c=this.overlays.getIteratorFrom(a);for(;c.hasNext();){const h=c.getNext().value,f=h.getKey();if(!e.isPrefixOf(f.path))break;f.path.length===o&&h.largestBatchId>r&&i.set(h.getKey(),h)}return S.resolve(i)}getOverlaysForCollectionGroup(t,e,r,i){let o=new X((f,p)=>f-p);const a=this.overlays.getIterator();for(;a.hasNext();){const f=a.getNext().value;if(f.getKey().getCollectionGroup()===e&&f.largestBatchId>r){let p=o.get(f.largestBatchId);p===null&&(p=ie(),o=o.insert(f.largestBatchId,p)),p.set(f.getKey(),f)}}const c=ie(),h=o.getIterator();for(;h.hasNext()&&(h.getNext().value.forEach((f,p)=>c.set(f,p)),!(c.size()>=i)););return S.resolve(c)}ht(t,e,r){const i=this.overlays.get(r.key);if(i!==null){const a=this.Ir.get(i.largestBatchId).delete(r.key);this.Ir.set(i.largestBatchId,a)}this.overlays=this.overlays.insert(r.key,new Kh(e,r));let o=this.Ir.get(e);o===void 0&&(o=U(),this.Ir.set(e,o)),this.Ir.set(e,o.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wd{constructor(){this.sessionToken=ct.EMPTY_BYTE_STRING}getSessionToken(t){return S.resolve(this.sessionToken)}setSessionToken(t,e){return this.sessionToken=e,S.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ls{constructor(){this.Tr=new lt(st.Er),this.dr=new lt(st.Ar)}isEmpty(){return this.Tr.isEmpty()}addReference(t,e){const r=new st(t,e);this.Tr=this.Tr.add(r),this.dr=this.dr.add(r)}Rr(t,e){t.forEach(r=>this.addReference(r,e))}removeReference(t,e){this.Vr(new st(t,e))}mr(t,e){t.forEach(r=>this.removeReference(r,e))}gr(t){const e=new O(new Y([])),r=new st(e,t),i=new st(e,t+1),o=[];return this.dr.forEachInRange([r,i],a=>{this.Vr(a),o.push(a.key)}),o}pr(){this.Tr.forEach(t=>this.Vr(t))}Vr(t){this.Tr=this.Tr.delete(t),this.dr=this.dr.delete(t)}yr(t){const e=new O(new Y([])),r=new st(e,t),i=new st(e,t+1);let o=U();return this.dr.forEachInRange([r,i],a=>{o=o.add(a.key)}),o}containsKey(t){const e=new st(t,0),r=this.Tr.firstAfterOrEqual(e);return r!==null&&t.isEqual(r.key)}}class st{constructor(t,e){this.key=t,this.wr=e}static Er(t,e){return O.comparator(t.key,e.key)||$(t.wr,e.wr)}static Ar(t,e){return $(t.wr,e.wr)||O.comparator(t.key,e.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rd{constructor(t,e){this.indexManager=t,this.referenceDelegate=e,this.mutationQueue=[],this.Sr=1,this.br=new lt(st.Er)}checkEmpty(t){return S.resolve(this.mutationQueue.length===0)}addMutationBatch(t,e,r,i){const o=this.Sr;this.Sr++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const a=new Gh(o,e,r,i);this.mutationQueue.push(a);for(const c of i)this.br=this.br.add(new st(c.key,o)),this.indexManager.addToCollectionParentIndex(t,c.key.path.popLast());return S.resolve(a)}lookupMutationBatch(t,e){return S.resolve(this.Dr(e))}getNextMutationBatchAfterBatchId(t,e){const r=e+1,i=this.vr(r),o=i<0?0:i;return S.resolve(this.mutationQueue.length>o?this.mutationQueue[o]:null)}getHighestUnacknowledgedBatchId(){return S.resolve(this.mutationQueue.length===0?-1:this.Sr-1)}getAllMutationBatches(t){return S.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(t,e){const r=new st(e,0),i=new st(e,Number.POSITIVE_INFINITY),o=[];return this.br.forEachInRange([r,i],a=>{const c=this.Dr(a.wr);o.push(c)}),S.resolve(o)}getAllMutationBatchesAffectingDocumentKeys(t,e){let r=new lt($);return e.forEach(i=>{const o=new st(i,0),a=new st(i,Number.POSITIVE_INFINITY);this.br.forEachInRange([o,a],c=>{r=r.add(c.wr)})}),S.resolve(this.Cr(r))}getAllMutationBatchesAffectingQuery(t,e){const r=e.path,i=r.length+1;let o=r;O.isDocumentKey(o)||(o=o.child(""));const a=new st(new O(o),0);let c=new lt($);return this.br.forEachWhile(h=>{const f=h.key.path;return!!r.isPrefixOf(f)&&(f.length===i&&(c=c.add(h.wr)),!0)},a),S.resolve(this.Cr(c))}Cr(t){const e=[];return t.forEach(r=>{const i=this.Dr(r);i!==null&&e.push(i)}),e}removeMutationBatch(t,e){G(this.Fr(e.batchId,"removed")===0),this.mutationQueue.shift();let r=this.br;return S.forEach(e.mutations,i=>{const o=new st(i.key,e.batchId);return r=r.delete(o),this.referenceDelegate.markPotentiallyOrphaned(t,i.key)}).next(()=>{this.br=r})}On(t){}containsKey(t,e){const r=new st(e,0),i=this.br.firstAfterOrEqual(r);return S.resolve(e.isEqual(i&&i.key))}performConsistencyCheck(t){return this.mutationQueue.length,S.resolve()}Fr(t,e){return this.vr(t)}vr(t){return this.mutationQueue.length===0?0:t-this.mutationQueue[0].batchId}Dr(t){const e=this.vr(t);return e<0||e>=this.mutationQueue.length?null:this.mutationQueue[e]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pd{constructor(t){this.Mr=t,this.docs=function(){return new X(O.comparator)}(),this.size=0}setIndexManager(t){this.indexManager=t}addEntry(t,e){const r=e.key,i=this.docs.get(r),o=i?i.size:0,a=this.Mr(e);return this.docs=this.docs.insert(r,{document:e.mutableCopy(),size:a}),this.size+=a-o,this.indexManager.addToCollectionParentIndex(t,r.path.popLast())}removeEntry(t){const e=this.docs.get(t);e&&(this.docs=this.docs.remove(t),this.size-=e.size)}getEntry(t,e){const r=this.docs.get(e);return S.resolve(r?r.document.mutableCopy():_t.newInvalidDocument(e))}getEntries(t,e){let r=Ut();return e.forEach(i=>{const o=this.docs.get(i);r=r.insert(i,o?o.document.mutableCopy():_t.newInvalidDocument(i))}),S.resolve(r)}getDocumentsMatchingQuery(t,e,r,i){let o=Ut();const a=e.path,c=new O(a.child("")),h=this.docs.getIteratorFrom(c);for(;h.hasNext();){const{key:f,value:{document:p}}=h.getNext();if(!a.isPrefixOf(f.path))break;f.path.length>a.length+1||lh(uh(p),r)<=0||(i.has(p.key)||hr(e,p))&&(o=o.insert(p.key,p.mutableCopy()))}return S.resolve(o)}getAllFromCollectionGroup(t,e,r,i){x()}Or(t,e){return S.forEach(this.docs,r=>e(r))}newChangeBuffer(t){return new Vd(this)}getSize(t){return S.resolve(this.size)}}class Vd extends Ed{constructor(t){super(),this.cr=t}applyChanges(t){const e=[];return this.changes.forEach((r,i)=>{i.isValidDocument()?e.push(this.cr.addEntry(t,i)):this.cr.removeEntry(r)}),S.waitFor(e)}getFromCache(t,e){return this.cr.getEntry(t,e)}getAllFromCache(t,e){return this.cr.getEntries(t,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sd{constructor(t){this.persistence=t,this.Nr=new De(e=>bs(e),Ds),this.lastRemoteSnapshotVersion=L.min(),this.highestTargetId=0,this.Lr=0,this.Br=new Ls,this.targetCount=0,this.kr=Re.Bn()}forEachTarget(t,e){return this.Nr.forEach((r,i)=>e(i)),S.resolve()}getLastRemoteSnapshotVersion(t){return S.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(t){return S.resolve(this.Lr)}allocateTargetId(t){return this.highestTargetId=this.kr.next(),S.resolve(this.highestTargetId)}setTargetsMetadata(t,e,r){return r&&(this.lastRemoteSnapshotVersion=r),e>this.Lr&&(this.Lr=e),S.resolve()}Kn(t){this.Nr.set(t.target,t);const e=t.targetId;e>this.highestTargetId&&(this.kr=new Re(e),this.highestTargetId=e),t.sequenceNumber>this.Lr&&(this.Lr=t.sequenceNumber)}addTargetData(t,e){return this.Kn(e),this.targetCount+=1,S.resolve()}updateTargetData(t,e){return this.Kn(e),S.resolve()}removeTargetData(t,e){return this.Nr.delete(e.target),this.Br.gr(e.targetId),this.targetCount-=1,S.resolve()}removeTargets(t,e,r){let i=0;const o=[];return this.Nr.forEach((a,c)=>{c.sequenceNumber<=e&&r.get(c.targetId)===null&&(this.Nr.delete(a),o.push(this.removeMatchingKeysForTargetId(t,c.targetId)),i++)}),S.waitFor(o).next(()=>i)}getTargetCount(t){return S.resolve(this.targetCount)}getTargetData(t,e){const r=this.Nr.get(e)||null;return S.resolve(r)}addMatchingKeys(t,e,r){return this.Br.Rr(e,r),S.resolve()}removeMatchingKeys(t,e,r){this.Br.mr(e,r);const i=this.persistence.referenceDelegate,o=[];return i&&e.forEach(a=>{o.push(i.markPotentiallyOrphaned(t,a))}),S.waitFor(o)}removeMatchingKeysForTargetId(t,e){return this.Br.gr(e),S.resolve()}getMatchingKeysForTargetId(t,e){const r=this.Br.yr(e);return S.resolve(r)}containsKey(t,e){return S.resolve(this.Br.containsKey(e))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cd{constructor(t,e){this.qr={},this.overlays={},this.Qr=new Ps(0),this.Kr=!1,this.Kr=!0,this.$r=new wd,this.referenceDelegate=t(this),this.Ur=new Sd(this),this.indexManager=new _d,this.remoteDocumentCache=function(i){return new Pd(i)}(r=>this.referenceDelegate.Wr(r)),this.serializer=new md(e),this.Gr=new Id(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.Kr=!1,Promise.resolve()}get started(){return this.Kr}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(t){return this.indexManager}getDocumentOverlayCache(t){let e=this.overlays[t.toKey()];return e||(e=new Ad,this.overlays[t.toKey()]=e),e}getMutationQueue(t,e){let r=this.qr[t.toKey()];return r||(r=new Rd(e,this.referenceDelegate),this.qr[t.toKey()]=r),r}getGlobalsCache(){return this.$r}getTargetCache(){return this.Ur}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Gr}runTransaction(t,e,r){k("MemoryPersistence","Starting transaction:",t);const i=new bd(this.Qr.next());return this.referenceDelegate.zr(),r(i).next(o=>this.referenceDelegate.jr(i).next(()=>o)).toPromise().then(o=>(i.raiseOnCommittedEvent(),o))}Hr(t,e){return S.or(Object.values(this.qr).map(r=>()=>r.containsKey(t,e)))}}class bd extends hh{constructor(t){super(),this.currentSequenceNumber=t}}class Fs{constructor(t){this.persistence=t,this.Jr=new Ls,this.Yr=null}static Zr(t){return new Fs(t)}get Xr(){if(this.Yr)return this.Yr;throw x()}addReference(t,e,r){return this.Jr.addReference(r,e),this.Xr.delete(r.toString()),S.resolve()}removeReference(t,e,r){return this.Jr.removeReference(r,e),this.Xr.add(r.toString()),S.resolve()}markPotentiallyOrphaned(t,e){return this.Xr.add(e.toString()),S.resolve()}removeTarget(t,e){this.Jr.gr(e.targetId).forEach(i=>this.Xr.add(i.toString()));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(t,e.targetId).next(i=>{i.forEach(o=>this.Xr.add(o.toString()))}).next(()=>r.removeTargetData(t,e))}zr(){this.Yr=new Set}jr(t){const e=this.persistence.getRemoteDocumentCache().newChangeBuffer();return S.forEach(this.Xr,r=>{const i=O.fromPath(r);return this.ei(t,i).next(o=>{o||e.removeEntry(i,L.min())})}).next(()=>(this.Yr=null,e.apply(t)))}updateLimboDocument(t,e){return this.ei(t,e).next(r=>{r?this.Xr.delete(e.toString()):this.Xr.add(e.toString())})}Wr(t){return 0}ei(t,e){return S.or([()=>S.resolve(this.Jr.containsKey(e)),()=>this.persistence.getTargetCache().containsKey(t,e),()=>this.persistence.Hr(t,e)])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Us{constructor(t,e,r,i){this.targetId=t,this.fromCache=e,this.$i=r,this.Ui=i}static Wi(t,e){let r=U(),i=U();for(const o of e.docChanges)switch(o.type){case 0:r=r.add(o.doc.key);break;case 1:i=i.add(o.doc.key)}return new Us(t,e.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Dd{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(t){this._documentReadCount+=t}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nd{constructor(){this.Gi=!1,this.zi=!1,this.ji=100,this.Hi=function(){return kl()?8:dh(Dl())>0?6:4}()}initialize(t,e){this.Ji=t,this.indexManager=e,this.Gi=!0}getDocumentsMatchingQuery(t,e,r,i){const o={result:null};return this.Yi(t,e).next(a=>{o.result=a}).next(()=>{if(!o.result)return this.Zi(t,e,i,r).next(a=>{o.result=a})}).next(()=>{if(o.result)return;const a=new Dd;return this.Xi(t,e,a).next(c=>{if(o.result=c,this.zi)return this.es(t,e,a,c.size)})}).next(()=>o.result)}es(t,e,r,i){return r.documentReadCount<this.ji?(Ye()<=q.DEBUG&&k("QueryEngine","SDK will not create cache indexes for query:",ge(e),"since it only creates cache indexes for collection contains","more than or equal to",this.ji,"documents"),S.resolve()):(Ye()<=q.DEBUG&&k("QueryEngine","Query:",ge(e),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.Hi*i?(Ye()<=q.DEBUG&&k("QueryEngine","The SDK decides to create cache indexes for query:",ge(e),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(t,St(e))):S.resolve())}Yi(t,e){if(Oo(e))return S.resolve(null);let r=St(e);return this.indexManager.getIndexType(t,r).next(i=>i===0?null:(e.limit!==null&&i===1&&(e=fs(e,null,"F"),r=St(e)),this.indexManager.getDocumentsMatchingTarget(t,r).next(o=>{const a=U(...o);return this.Ji.getDocuments(t,a).next(c=>this.indexManager.getMinOffset(t,r).next(h=>{const f=this.ts(e,c);return this.ns(e,f,a,h.readTime)?this.Yi(t,fs(e,null,"F")):this.rs(t,f,e,h)}))})))}Zi(t,e,r,i){return Oo(e)||i.isEqual(L.min())?S.resolve(null):this.Ji.getDocuments(t,r).next(o=>{const a=this.ts(e,o);return this.ns(e,a,r,i)?S.resolve(null):(Ye()<=q.DEBUG&&k("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),ge(e)),this.rs(t,a,e,ah(i,-1)).next(c=>c))})}ts(t,e){let r=new lt(Fa(t));return e.forEach((i,o)=>{hr(t,o)&&(r=r.add(o))}),r}ns(t,e,r,i){if(t.limit===null)return!1;if(r.size!==e.size)return!0;const o=t.limitType==="F"?e.last():e.first();return!!o&&(o.hasPendingWrites||o.version.compareTo(i)>0)}Xi(t,e,r){return Ye()<=q.DEBUG&&k("QueryEngine","Using full collection scan to execute query:",ge(e)),this.Ji.getDocumentsMatchingQuery(t,e,Qt.min(),r)}rs(t,e,r,i){return this.Ji.getDocumentsMatchingQuery(t,r,i).next(o=>(e.forEach(a=>{o=o.insert(a.key,a)}),o))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kd{constructor(t,e,r,i){this.persistence=t,this.ss=e,this.serializer=i,this.os=new X($),this._s=new De(o=>bs(o),Ds),this.us=new Map,this.cs=t.getRemoteDocumentCache(),this.Ur=t.getTargetCache(),this.Gr=t.getBundleCache(),this.ls(r)}ls(t){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(t),this.indexManager=this.persistence.getIndexManager(t),this.mutationQueue=this.persistence.getMutationQueue(t,this.indexManager),this.localDocuments=new Td(this.cs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.cs.setIndexManager(this.indexManager),this.ss.initialize(this.localDocuments,this.indexManager)}collectGarbage(t){return this.persistence.runTransaction("Collect garbage","readwrite-primary",e=>t.collect(e,this.os))}}function Md(n,t,e,r){return new kd(n,t,e,r)}async function iu(n,t){const e=F(n);return await e.persistence.runTransaction("Handle user change","readonly",r=>{let i;return e.mutationQueue.getAllMutationBatches(r).next(o=>(i=o,e.ls(t),e.mutationQueue.getAllMutationBatches(r))).next(o=>{const a=[],c=[];let h=U();for(const f of i){a.push(f.batchId);for(const p of f.mutations)h=h.add(p.key)}for(const f of o){c.push(f.batchId);for(const p of f.mutations)h=h.add(p.key)}return e.localDocuments.getDocuments(r,h).next(f=>({hs:f,removedBatchIds:a,addedBatchIds:c}))})})}function Od(n,t){const e=F(n);return e.persistence.runTransaction("Acknowledge batch","readwrite-primary",r=>{const i=t.batch.keys(),o=e.cs.newChangeBuffer({trackRemovals:!0});return function(c,h,f,p){const I=f.batch,w=I.keys();let V=S.resolve();return w.forEach(D=>{V=V.next(()=>p.getEntry(h,D)).next(M=>{const b=f.docVersions.get(D);G(b!==null),M.version.compareTo(b)<0&&(I.applyToRemoteDocument(M,f),M.isValidDocument()&&(M.setReadTime(f.commitVersion),p.addEntry(M)))})}),V.next(()=>c.mutationQueue.removeMutationBatch(h,I))}(e,r,t,o).next(()=>o.apply(r)).next(()=>e.mutationQueue.performConsistencyCheck(r)).next(()=>e.documentOverlayCache.removeOverlaysForBatchId(r,i,t.batch.batchId)).next(()=>e.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,function(c){let h=U();for(let f=0;f<c.mutationResults.length;++f)c.mutationResults[f].transformResults.length>0&&(h=h.add(c.batch.mutations[f].key));return h}(t))).next(()=>e.localDocuments.getDocuments(r,i))})}function ou(n){const t=F(n);return t.persistence.runTransaction("Get last remote snapshot version","readonly",e=>t.Ur.getLastRemoteSnapshotVersion(e))}function xd(n,t){const e=F(n),r=t.snapshotVersion;let i=e.os;return e.persistence.runTransaction("Apply remote event","readwrite-primary",o=>{const a=e.cs.newChangeBuffer({trackRemovals:!0});i=e.os;const c=[];t.targetChanges.forEach((p,I)=>{const w=i.get(I);if(!w)return;c.push(e.Ur.removeMatchingKeys(o,p.removedDocuments,I).next(()=>e.Ur.addMatchingKeys(o,p.addedDocuments,I)));let V=w.withSequenceNumber(o.currentSequenceNumber);t.targetMismatches.get(I)!==null?V=V.withResumeToken(ct.EMPTY_BYTE_STRING,L.min()).withLastLimboFreeSnapshotVersion(L.min()):p.resumeToken.approximateByteSize()>0&&(V=V.withResumeToken(p.resumeToken,r)),i=i.insert(I,V),function(M,b,z){return M.resumeToken.approximateByteSize()===0||b.snapshotVersion.toMicroseconds()-M.snapshotVersion.toMicroseconds()>=3e8?!0:z.addedDocuments.size+z.modifiedDocuments.size+z.removedDocuments.size>0}(w,V,p)&&c.push(e.Ur.updateTargetData(o,V))});let h=Ut(),f=U();if(t.documentUpdates.forEach(p=>{t.resolvedLimboDocuments.has(p)&&c.push(e.persistence.referenceDelegate.updateLimboDocument(o,p))}),c.push(Ld(o,a,t.documentUpdates).next(p=>{h=p.Ps,f=p.Is})),!r.isEqual(L.min())){const p=e.Ur.getLastRemoteSnapshotVersion(o).next(I=>e.Ur.setTargetsMetadata(o,o.currentSequenceNumber,r));c.push(p)}return S.waitFor(c).next(()=>a.apply(o)).next(()=>e.localDocuments.getLocalViewOfDocuments(o,h,f)).next(()=>h)}).then(o=>(e.os=i,o))}function Ld(n,t,e){let r=U(),i=U();return e.forEach(o=>r=r.add(o)),t.getEntries(n,r).next(o=>{let a=Ut();return e.forEach((c,h)=>{const f=o.get(c);h.isFoundDocument()!==f.isFoundDocument()&&(i=i.add(c)),h.isNoDocument()&&h.version.isEqual(L.min())?(t.removeEntry(c,h.readTime),a=a.insert(c,h)):!f.isValidDocument()||h.version.compareTo(f.version)>0||h.version.compareTo(f.version)===0&&f.hasPendingWrites?(t.addEntry(h),a=a.insert(c,h)):k("LocalStore","Ignoring outdated watch update for ",c,". Current version:",f.version," Watch version:",h.version)}),{Ps:a,Is:i}})}function Fd(n,t){const e=F(n);return e.persistence.runTransaction("Get next mutation batch","readonly",r=>(t===void 0&&(t=-1),e.mutationQueue.getNextMutationBatchAfterBatchId(r,t)))}function Ud(n,t){const e=F(n);return e.persistence.runTransaction("Allocate target","readwrite",r=>{let i;return e.Ur.getTargetData(r,t).next(o=>o?(i=o,S.resolve(i)):e.Ur.allocateTargetId(r).next(a=>(i=new zt(t,a,"TargetPurposeListen",r.currentSequenceNumber),e.Ur.addTargetData(r,i).next(()=>i))))}).then(r=>{const i=e.os.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(e.os=e.os.insert(r.targetId,r),e._s.set(t,r.targetId)),r})}async function ys(n,t,e){const r=F(n),i=r.os.get(t),o=e?"readwrite":"readwrite-primary";try{e||await r.persistence.runTransaction("Release target",o,a=>r.persistence.referenceDelegate.removeTarget(a,i))}catch(a){if(!_n(a))throw a;k("LocalStore",`Failed to update sequence numbers for target ${t}: ${a}`)}r.os=r.os.remove(t),r._s.delete(i.target)}function Ko(n,t,e){const r=F(n);let i=L.min(),o=U();return r.persistence.runTransaction("Execute query","readwrite",a=>function(h,f,p){const I=F(h),w=I._s.get(p);return w!==void 0?S.resolve(I.os.get(w)):I.Ur.getTargetData(f,p)}(r,a,St(t)).next(c=>{if(c)return i=c.lastLimboFreeSnapshotVersion,r.Ur.getMatchingKeysForTargetId(a,c.targetId).next(h=>{o=h})}).next(()=>r.ss.getDocumentsMatchingQuery(a,t,e?i:L.min(),e?o:U())).next(c=>(Bd(r,bh(t),c),{documents:c,Ts:o})))}function Bd(n,t,e){let r=n.us.get(t)||L.min();e.forEach((i,o)=>{o.readTime.compareTo(r)>0&&(r=o.readTime)}),n.us.set(t,r)}class Wo{constructor(){this.activeTargetIds=xh()}fs(t){this.activeTargetIds=this.activeTargetIds.add(t)}gs(t){this.activeTargetIds=this.activeTargetIds.delete(t)}Vs(){const t={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(t)}}class qd{constructor(){this.so=new Wo,this.oo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(t){}updateMutationState(t,e,r){}addLocalQueryTarget(t,e=!0){return e&&this.so.fs(t),this.oo[t]||"not-current"}updateQueryState(t,e,r){this.oo[t]=e}removeLocalQueryTarget(t){this.so.gs(t)}isLocalQueryTarget(t){return this.so.activeTargetIds.has(t)}clearQueryState(t){delete this.oo[t]}getAllActiveQueryTargets(){return this.so.activeTargetIds}isActiveQueryTarget(t){return this.so.activeTargetIds.has(t)}start(){return this.so=new Wo,Promise.resolve()}handleUserChange(t,e,r){}setOnlineState(t){}shutdown(){}writeSequenceNumber(t){}notifyBundleLoaded(t){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jd{_o(t){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qo{constructor(){this.ao=()=>this.uo(),this.co=()=>this.lo(),this.ho=[],this.Po()}_o(t){this.ho.push(t)}shutdown(){window.removeEventListener("online",this.ao),window.removeEventListener("offline",this.co)}Po(){window.addEventListener("online",this.ao),window.addEventListener("offline",this.co)}uo(){k("ConnectivityMonitor","Network connectivity changed: AVAILABLE");for(const t of this.ho)t(0)}lo(){k("ConnectivityMonitor","Network connectivity changed: UNAVAILABLE");for(const t of this.ho)t(1)}static D(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Gn=null;function Jr(){return Gn===null?Gn=function(){return 268435456+Math.round(2147483648*Math.random())}():Gn++,"0x"+Gn.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $d={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery"};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zd{constructor(t){this.Io=t.Io,this.To=t.To}Eo(t){this.Ao=t}Ro(t){this.Vo=t}mo(t){this.fo=t}onMessage(t){this.po=t}close(){this.To()}send(t){this.Io(t)}yo(){this.Ao()}wo(){this.Vo()}So(t){this.fo(t)}bo(t){this.po(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mt="WebChannelConnection";class Gd extends class{constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const r=e.ssl?"https":"http",i=encodeURIComponent(this.databaseId.projectId),o=encodeURIComponent(this.databaseId.database);this.Do=r+"://"+e.host,this.vo=`projects/${i}/databases/${o}`,this.Co=this.databaseId.database==="(default)"?`project_id=${i}`:`project_id=${i}&database_id=${o}`}get Fo(){return!1}Mo(e,r,i,o,a){const c=Jr(),h=this.xo(e,r.toUriEncodedString());k("RestConnection",`Sending RPC '${e}' ${c}:`,h,i);const f={"google-cloud-resource-prefix":this.vo,"x-goog-request-params":this.Co};return this.Oo(f,o,a),this.No(e,h,f,i).then(p=>(k("RestConnection",`Received RPC '${e}' ${c}: `,p),p),p=>{throw Te("RestConnection",`RPC '${e}' ${c} failed with error: `,p,"url: ",h,"request:",i),p})}Lo(e,r,i,o,a,c){return this.Mo(e,r,i,o,a)}Oo(e,r,i){e["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+Ce}(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),r&&r.headers.forEach((o,a)=>e[a]=o),i&&i.headers.forEach((o,a)=>e[a]=o)}xo(e,r){const i=$d[e];return`${this.Do}/v1/${r}:${i}`}terminate(){}}{constructor(t){super(t),this.forceLongPolling=t.forceLongPolling,this.autoDetectLongPolling=t.autoDetectLongPolling,this.useFetchStreams=t.useFetchStreams,this.longPollingOptions=t.longPollingOptions}No(t,e,r,i){const o=Jr();return new Promise((a,c)=>{const h=new va;h.setWithCredentials(!0),h.listenOnce(Ta.COMPLETE,()=>{try{switch(h.getLastErrorCode()){case Kn.NO_ERROR:const p=h.getResponseJson();k(mt,`XHR for RPC '${t}' ${o} received:`,JSON.stringify(p)),a(p);break;case Kn.TIMEOUT:k(mt,`RPC '${t}' ${o} timed out`),c(new N(P.DEADLINE_EXCEEDED,"Request time out"));break;case Kn.HTTP_ERROR:const I=h.getStatus();if(k(mt,`RPC '${t}' ${o} failed with status:`,I,"response text:",h.getResponseText()),I>0){let w=h.getResponseJson();Array.isArray(w)&&(w=w[0]);const V=w?.error;if(V&&V.status&&V.message){const D=function(b){const z=b.toLowerCase().replace(/_/g,"-");return Object.values(P).indexOf(z)>=0?z:P.UNKNOWN}(V.status);c(new N(D,V.message))}else c(new N(P.UNKNOWN,"Server responded with status "+h.getStatus()))}else c(new N(P.UNAVAILABLE,"Connection failed."));break;default:x()}}finally{k(mt,`RPC '${t}' ${o} completed.`)}});const f=JSON.stringify(i);k(mt,`RPC '${t}' ${o} sending request:`,i),h.send(e,"POST",f,r,15)})}Bo(t,e,r){const i=Jr(),o=[this.Do,"/","google.firestore.v1.Firestore","/",t,"/channel"],a=wa(),c=Aa(),h={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},f=this.longPollingOptions.timeoutSeconds;f!==void 0&&(h.longPollingTimeout=Math.round(1e3*f)),this.useFetchStreams&&(h.useFetchStreams=!0),this.Oo(h.initMessageHeaders,e,r),h.encodeInitMessageHeaders=!0;const p=o.join("");k(mt,`Creating RPC '${t}' stream ${i}: ${p}`,h);const I=a.createWebChannel(p,h);let w=!1,V=!1;const D=new zd({Io:b=>{V?k(mt,`Not sending because RPC '${t}' stream ${i} is closed:`,b):(w||(k(mt,`Opening RPC '${t}' stream ${i} transport.`),I.open(),w=!0),k(mt,`RPC '${t}' stream ${i} sending:`,b),I.send(b))},To:()=>I.close()}),M=(b,z,K)=>{b.listen(z,Q=>{try{K(Q)}catch(rt){setTimeout(()=>{throw rt},0)}})};return M(I,Xe.EventType.OPEN,()=>{V||(k(mt,`RPC '${t}' stream ${i} transport opened.`),D.yo())}),M(I,Xe.EventType.CLOSE,()=>{V||(V=!0,k(mt,`RPC '${t}' stream ${i} transport closed`),D.So())}),M(I,Xe.EventType.ERROR,b=>{V||(V=!0,Te(mt,`RPC '${t}' stream ${i} transport errored:`,b),D.So(new N(P.UNAVAILABLE,"The operation could not be completed")))}),M(I,Xe.EventType.MESSAGE,b=>{var z;if(!V){const K=b.data[0];G(!!K);const Q=K,rt=Q.error||((z=Q[0])===null||z===void 0?void 0:z.error);if(rt){k(mt,`RPC '${t}' stream ${i} received error:`,rt);const Nt=rt.status;let it=function(_){const y=tt[_];if(y!==void 0)return Ha(y)}(Nt),v=rt.message;it===void 0&&(it=P.INTERNAL,v="Unknown error status: "+Nt+" with message "+rt.message),V=!0,D.So(new N(it,v)),I.close()}else k(mt,`RPC '${t}' stream ${i} received:`,K),D.bo(K)}}),M(c,Ia.STAT_EVENT,b=>{b.stat===as.PROXY?k(mt,`RPC '${t}' stream ${i} detected buffering proxy`):b.stat===as.NOPROXY&&k(mt,`RPC '${t}' stream ${i} detected no buffering proxy`)}),setTimeout(()=>{D.wo()},0),D}}function Zr(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mr(n){return new ed(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class au{constructor(t,e,r=1e3,i=1.5,o=6e4){this.ui=t,this.timerId=e,this.ko=r,this.qo=i,this.Qo=o,this.Ko=0,this.$o=null,this.Uo=Date.now(),this.reset()}reset(){this.Ko=0}Wo(){this.Ko=this.Qo}Go(t){this.cancel();const e=Math.floor(this.Ko+this.zo()),r=Math.max(0,Date.now()-this.Uo),i=Math.max(0,e-r);i>0&&k("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.Ko} ms, delay with jitter: ${e} ms, last attempt: ${r} ms ago)`),this.$o=this.ui.enqueueAfterDelay(this.timerId,i,()=>(this.Uo=Date.now(),t())),this.Ko*=this.qo,this.Ko<this.ko&&(this.Ko=this.ko),this.Ko>this.Qo&&(this.Ko=this.Qo)}jo(){this.$o!==null&&(this.$o.skipDelay(),this.$o=null)}cancel(){this.$o!==null&&(this.$o.cancel(),this.$o=null)}zo(){return(Math.random()-.5)*this.Ko}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uu{constructor(t,e,r,i,o,a,c,h){this.ui=t,this.Ho=r,this.Jo=i,this.connection=o,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=c,this.listener=h,this.state=0,this.Yo=0,this.Zo=null,this.Xo=null,this.stream=null,this.e_=0,this.t_=new au(t,e)}n_(){return this.state===1||this.state===5||this.r_()}r_(){return this.state===2||this.state===3}start(){this.e_=0,this.state!==4?this.auth():this.i_()}async stop(){this.n_()&&await this.close(0)}s_(){this.state=0,this.t_.reset()}o_(){this.r_()&&this.Zo===null&&(this.Zo=this.ui.enqueueAfterDelay(this.Ho,6e4,()=>this.__()))}a_(t){this.u_(),this.stream.send(t)}async __(){if(this.r_())return this.close(0)}u_(){this.Zo&&(this.Zo.cancel(),this.Zo=null)}c_(){this.Xo&&(this.Xo.cancel(),this.Xo=null)}async close(t,e){this.u_(),this.c_(),this.t_.cancel(),this.Yo++,t!==4?this.t_.reset():e&&e.code===P.RESOURCE_EXHAUSTED?(Ft(e.toString()),Ft("Using maximum backoff delay to prevent overloading the backend."),this.t_.Wo()):e&&e.code===P.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.l_(),this.stream.close(),this.stream=null),this.state=t,await this.listener.mo(e)}l_(){}auth(){this.state=1;const t=this.h_(this.Yo),e=this.Yo;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then(([r,i])=>{this.Yo===e&&this.P_(r,i)},r=>{t(()=>{const i=new N(P.UNKNOWN,"Fetching auth token failed: "+r.message);return this.I_(i)})})}P_(t,e){const r=this.h_(this.Yo);this.stream=this.T_(t,e),this.stream.Eo(()=>{r(()=>this.listener.Eo())}),this.stream.Ro(()=>{r(()=>(this.state=2,this.Xo=this.ui.enqueueAfterDelay(this.Jo,1e4,()=>(this.r_()&&(this.state=3),Promise.resolve())),this.listener.Ro()))}),this.stream.mo(i=>{r(()=>this.I_(i))}),this.stream.onMessage(i=>{r(()=>++this.e_==1?this.E_(i):this.onNext(i))})}i_(){this.state=5,this.t_.Go(async()=>{this.state=0,this.start()})}I_(t){return k("PersistentStream",`close with error: ${t}`),this.stream=null,this.close(4,t)}h_(t){return e=>{this.ui.enqueueAndForget(()=>this.Yo===t?e():(k("PersistentStream","stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve()))}}}class Kd extends uu{constructor(t,e,r,i,o,a){super(t,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",e,r,i,a),this.serializer=o}T_(t,e){return this.connection.Bo("Listen",t,e)}E_(t){return this.onNext(t)}onNext(t){this.t_.reset();const e=sd(this.serializer,t),r=function(o){if(!("targetChange"in o))return L.min();const a=o.targetChange;return a.targetIds&&a.targetIds.length?L.min():a.readTime?Ct(a.readTime):L.min()}(t);return this.listener.d_(e,r)}A_(t){const e={};e.database=_s(this.serializer),e.addTarget=function(o,a){let c;const h=a.target;if(c=hs(h)?{documents:ad(o,h)}:{query:ud(o,h)._t},c.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){c.resumeToken=Ja(o,a.resumeToken);const f=ps(o,a.expectedCount);f!==null&&(c.expectedCount=f)}else if(a.snapshotVersion.compareTo(L.min())>0){c.readTime=rr(o,a.snapshotVersion.toTimestamp());const f=ps(o,a.expectedCount);f!==null&&(c.expectedCount=f)}return c}(this.serializer,t);const r=cd(this.serializer,t);r&&(e.labels=r),this.a_(e)}R_(t){const e={};e.database=_s(this.serializer),e.removeTarget=t,this.a_(e)}}class Wd extends uu{constructor(t,e,r,i,o,a){super(t,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",e,r,i,a),this.serializer=o}get V_(){return this.e_>0}start(){this.lastStreamToken=void 0,super.start()}l_(){this.V_&&this.m_([])}T_(t,e){return this.connection.Bo("Write",t,e)}E_(t){return G(!!t.streamToken),this.lastStreamToken=t.streamToken,G(!t.writeResults||t.writeResults.length===0),this.listener.f_()}onNext(t){G(!!t.streamToken),this.lastStreamToken=t.streamToken,this.t_.reset();const e=od(t.writeResults,t.commitTime),r=Ct(t.commitTime);return this.listener.g_(r,e)}p_(){const t={};t.database=_s(this.serializer),this.a_(t)}m_(t){const e={streamToken:this.lastStreamToken,writes:t.map(r=>id(this.serializer,r))};this.a_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qd extends class{}{constructor(t,e,r,i){super(),this.authCredentials=t,this.appCheckCredentials=e,this.connection=r,this.serializer=i,this.y_=!1}w_(){if(this.y_)throw new N(P.FAILED_PRECONDITION,"The client has already been terminated.")}Mo(t,e,r,i){return this.w_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([o,a])=>this.connection.Mo(t,ms(e,r),i,o,a)).catch(o=>{throw o.name==="FirebaseError"?(o.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new N(P.UNKNOWN,o.toString())})}Lo(t,e,r,i,o){return this.w_(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([a,c])=>this.connection.Lo(t,ms(e,r),i,a,c,o)).catch(a=>{throw a.name==="FirebaseError"?(a.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new N(P.UNKNOWN,a.toString())})}terminate(){this.y_=!0,this.connection.terminate()}}class Hd{constructor(t,e){this.asyncQueue=t,this.onlineStateHandler=e,this.state="Unknown",this.S_=0,this.b_=null,this.D_=!0}v_(){this.S_===0&&(this.C_("Unknown"),this.b_=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,()=>(this.b_=null,this.F_("Backend didn't respond within 10 seconds."),this.C_("Offline"),Promise.resolve())))}M_(t){this.state==="Online"?this.C_("Unknown"):(this.S_++,this.S_>=1&&(this.x_(),this.F_(`Connection failed 1 times. Most recent error: ${t.toString()}`),this.C_("Offline")))}set(t){this.x_(),this.S_=0,t==="Online"&&(this.D_=!1),this.C_(t)}C_(t){t!==this.state&&(this.state=t,this.onlineStateHandler(t))}F_(t){const e=`Could not reach Cloud Firestore backend. ${t}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.D_?(Ft(e),this.D_=!1):k("OnlineStateTracker",e)}x_(){this.b_!==null&&(this.b_.cancel(),this.b_=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yd{constructor(t,e,r,i,o){this.localStore=t,this.datastore=e,this.asyncQueue=r,this.remoteSyncer={},this.O_=[],this.N_=new Map,this.L_=new Set,this.B_=[],this.k_=o,this.k_._o(a=>{r.enqueueAndForget(async()=>{he(this)&&(k("RemoteStore","Restarting streams for network reachability change."),await async function(h){const f=F(h);f.L_.add(4),await vn(f),f.q_.set("Unknown"),f.L_.delete(4),await gr(f)}(this))})}),this.q_=new Hd(r,i)}}async function gr(n){if(he(n))for(const t of n.B_)await t(!0)}async function vn(n){for(const t of n.B_)await t(!1)}function lu(n,t){const e=F(n);e.N_.has(t.targetId)||(e.N_.set(t.targetId,t),$s(e)?js(e):Ne(e).r_()&&qs(e,t))}function Bs(n,t){const e=F(n),r=Ne(e);e.N_.delete(t),r.r_()&&cu(e,t),e.N_.size===0&&(r.r_()?r.o_():he(e)&&e.q_.set("Unknown"))}function qs(n,t){if(n.Q_.xe(t.targetId),t.resumeToken.approximateByteSize()>0||t.snapshotVersion.compareTo(L.min())>0){const e=n.remoteSyncer.getRemoteKeysForTarget(t.targetId).size;t=t.withExpectedCount(e)}Ne(n).A_(t)}function cu(n,t){n.Q_.xe(t),Ne(n).R_(t)}function js(n){n.Q_=new Xh({getRemoteKeysForTarget:t=>n.remoteSyncer.getRemoteKeysForTarget(t),ot:t=>n.N_.get(t)||null,tt:()=>n.datastore.serializer.databaseId}),Ne(n).start(),n.q_.v_()}function $s(n){return he(n)&&!Ne(n).n_()&&n.N_.size>0}function he(n){return F(n).L_.size===0}function hu(n){n.Q_=void 0}async function Xd(n){n.q_.set("Online")}async function Jd(n){n.N_.forEach((t,e)=>{qs(n,t)})}async function Zd(n,t){hu(n),$s(n)?(n.q_.M_(t),js(n)):n.q_.set("Unknown")}async function tf(n,t,e){if(n.q_.set("Online"),t instanceof Xa&&t.state===2&&t.cause)try{await async function(i,o){const a=o.cause;for(const c of o.targetIds)i.N_.has(c)&&(await i.remoteSyncer.rejectListen(c,a),i.N_.delete(c),i.Q_.removeTarget(c))}(n,t)}catch(r){k("RemoteStore","Failed to remove targets %s: %s ",t.targetIds.join(","),r),await sr(n,r)}else if(t instanceof Hn?n.Q_.Ke(t):t instanceof Ya?n.Q_.He(t):n.Q_.We(t),!e.isEqual(L.min()))try{const r=await ou(n.localStore);e.compareTo(r)>=0&&await function(o,a){const c=o.Q_.rt(a);return c.targetChanges.forEach((h,f)=>{if(h.resumeToken.approximateByteSize()>0){const p=o.N_.get(f);p&&o.N_.set(f,p.withResumeToken(h.resumeToken,a))}}),c.targetMismatches.forEach((h,f)=>{const p=o.N_.get(h);if(!p)return;o.N_.set(h,p.withResumeToken(ct.EMPTY_BYTE_STRING,p.snapshotVersion)),cu(o,h);const I=new zt(p.target,h,f,p.sequenceNumber);qs(o,I)}),o.remoteSyncer.applyRemoteEvent(c)}(n,e)}catch(r){k("RemoteStore","Failed to raise snapshot:",r),await sr(n,r)}}async function sr(n,t,e){if(!_n(t))throw t;n.L_.add(1),await vn(n),n.q_.set("Offline"),e||(e=()=>ou(n.localStore)),n.asyncQueue.enqueueRetryable(async()=>{k("RemoteStore","Retrying IndexedDB access"),await e(),n.L_.delete(1),await gr(n)})}function du(n,t){return t().catch(e=>sr(n,e,t))}async function _r(n){const t=F(n),e=Yt(t);let r=t.O_.length>0?t.O_[t.O_.length-1].batchId:-1;for(;ef(t);)try{const i=await Fd(t.localStore,r);if(i===null){t.O_.length===0&&e.o_();break}r=i.batchId,nf(t,i)}catch(i){await sr(t,i)}fu(t)&&pu(t)}function ef(n){return he(n)&&n.O_.length<10}function nf(n,t){n.O_.push(t);const e=Yt(n);e.r_()&&e.V_&&e.m_(t.mutations)}function fu(n){return he(n)&&!Yt(n).n_()&&n.O_.length>0}function pu(n){Yt(n).start()}async function rf(n){Yt(n).p_()}async function sf(n){const t=Yt(n);for(const e of n.O_)t.m_(e.mutations)}async function of(n,t,e){const r=n.O_.shift(),i=Ms.from(r,t,e);await du(n,()=>n.remoteSyncer.applySuccessfulWrite(i)),await _r(n)}async function af(n,t){t&&Yt(n).V_&&await async function(r,i){if(function(a){return Qh(a)&&a!==P.ABORTED}(i.code)){const o=r.O_.shift();Yt(r).s_(),await du(r,()=>r.remoteSyncer.rejectFailedWrite(o.batchId,i)),await _r(r)}}(n,t),fu(n)&&pu(n)}async function Ho(n,t){const e=F(n);e.asyncQueue.verifyOperationInProgress(),k("RemoteStore","RemoteStore received new credentials");const r=he(e);e.L_.add(3),await vn(e),r&&e.q_.set("Unknown"),await e.remoteSyncer.handleCredentialChange(t),e.L_.delete(3),await gr(e)}async function uf(n,t){const e=F(n);t?(e.L_.delete(2),await gr(e)):t||(e.L_.add(2),await vn(e),e.q_.set("Unknown"))}function Ne(n){return n.K_||(n.K_=function(e,r,i){const o=F(e);return o.w_(),new Kd(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)}(n.datastore,n.asyncQueue,{Eo:Xd.bind(null,n),Ro:Jd.bind(null,n),mo:Zd.bind(null,n),d_:tf.bind(null,n)}),n.B_.push(async t=>{t?(n.K_.s_(),$s(n)?js(n):n.q_.set("Unknown")):(await n.K_.stop(),hu(n))})),n.K_}function Yt(n){return n.U_||(n.U_=function(e,r,i){const o=F(e);return o.w_(),new Wd(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)}(n.datastore,n.asyncQueue,{Eo:()=>Promise.resolve(),Ro:rf.bind(null,n),mo:af.bind(null,n),f_:sf.bind(null,n),g_:of.bind(null,n)}),n.B_.push(async t=>{t?(n.U_.s_(),await _r(n)):(await n.U_.stop(),n.O_.length>0&&(k("RemoteStore",`Stopping write stream with ${n.O_.length} pending writes`),n.O_=[]))})),n.U_}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zs{constructor(t,e,r,i,o){this.asyncQueue=t,this.timerId=e,this.targetTimeMs=r,this.op=i,this.removalCallback=o,this.deferred=new xt,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch(a=>{})}get promise(){return this.deferred.promise}static createAndSchedule(t,e,r,i,o){const a=Date.now()+r,c=new zs(t,e,a,i,o);return c.start(r),c}start(t){this.timerHandle=setTimeout(()=>this.handleDelayElapsed(),t)}skipDelay(){return this.handleDelayElapsed()}cancel(t){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new N(P.CANCELLED,"Operation cancelled"+(t?": "+t:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget(()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then(t=>this.deferred.resolve(t))):Promise.resolve())}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function Gs(n,t){if(Ft("AsyncQueue",`${t}: ${n}`),_n(n))return new N(P.UNAVAILABLE,`${t}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ve{constructor(t){this.comparator=t?(e,r)=>t(e,r)||O.comparator(e.key,r.key):(e,r)=>O.comparator(e.key,r.key),this.keyedMap=Je(),this.sortedSet=new X(this.comparator)}static emptySet(t){return new ve(t.comparator)}has(t){return this.keyedMap.get(t)!=null}get(t){return this.keyedMap.get(t)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(t){const e=this.keyedMap.get(t);return e?this.sortedSet.indexOf(e):-1}get size(){return this.sortedSet.size}forEach(t){this.sortedSet.inorderTraversal((e,r)=>(t(e),!1))}add(t){const e=this.delete(t.key);return e.copy(e.keyedMap.insert(t.key,t),e.sortedSet.insert(t,null))}delete(t){const e=this.get(t);return e?this.copy(this.keyedMap.remove(t),this.sortedSet.remove(e)):this}isEqual(t){if(!(t instanceof ve)||this.size!==t.size)return!1;const e=this.sortedSet.getIterator(),r=t.sortedSet.getIterator();for(;e.hasNext();){const i=e.getNext().key,o=r.getNext().key;if(!i.isEqual(o))return!1}return!0}toString(){const t=[];return this.forEach(e=>{t.push(e.toString())}),t.length===0?"DocumentSet ()":`DocumentSet (
  `+t.join(`  
`)+`
)`}copy(t,e){const r=new ve;return r.comparator=this.comparator,r.keyedMap=t,r.sortedSet=e,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yo{constructor(){this.W_=new X(O.comparator)}track(t){const e=t.doc.key,r=this.W_.get(e);r?t.type!==0&&r.type===3?this.W_=this.W_.insert(e,t):t.type===3&&r.type!==1?this.W_=this.W_.insert(e,{type:r.type,doc:t.doc}):t.type===2&&r.type===2?this.W_=this.W_.insert(e,{type:2,doc:t.doc}):t.type===2&&r.type===0?this.W_=this.W_.insert(e,{type:0,doc:t.doc}):t.type===1&&r.type===0?this.W_=this.W_.remove(e):t.type===1&&r.type===2?this.W_=this.W_.insert(e,{type:1,doc:r.doc}):t.type===0&&r.type===1?this.W_=this.W_.insert(e,{type:2,doc:t.doc}):x():this.W_=this.W_.insert(e,t)}G_(){const t=[];return this.W_.inorderTraversal((e,r)=>{t.push(r)}),t}}class Pe{constructor(t,e,r,i,o,a,c,h,f){this.query=t,this.docs=e,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=o,this.fromCache=a,this.syncStateChanged=c,this.excludesMetadataChanges=h,this.hasCachedResults=f}static fromInitialDocuments(t,e,r,i,o){const a=[];return e.forEach(c=>{a.push({type:0,doc:c})}),new Pe(t,e,ve.emptySet(e),a,r,i,!0,!1,o)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(t){if(!(this.fromCache===t.fromCache&&this.hasCachedResults===t.hasCachedResults&&this.syncStateChanged===t.syncStateChanged&&this.mutatedKeys.isEqual(t.mutatedKeys)&&cr(this.query,t.query)&&this.docs.isEqual(t.docs)&&this.oldDocs.isEqual(t.oldDocs)))return!1;const e=this.docChanges,r=t.docChanges;if(e.length!==r.length)return!1;for(let i=0;i<e.length;i++)if(e[i].type!==r[i].type||!e[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lf{constructor(){this.z_=void 0,this.j_=[]}H_(){return this.j_.some(t=>t.J_())}}class cf{constructor(){this.queries=Xo(),this.onlineState="Unknown",this.Y_=new Set}terminate(){(function(e,r){const i=F(e),o=i.queries;i.queries=Xo(),o.forEach((a,c)=>{for(const h of c.j_)h.onError(r)})})(this,new N(P.ABORTED,"Firestore shutting down"))}}function Xo(){return new De(n=>La(n),cr)}async function Ks(n,t){const e=F(n);let r=3;const i=t.query;let o=e.queries.get(i);o?!o.H_()&&t.J_()&&(r=2):(o=new lf,r=t.J_()?0:1);try{switch(r){case 0:o.z_=await e.onListen(i,!0);break;case 1:o.z_=await e.onListen(i,!1);break;case 2:await e.onFirstRemoteStoreListen(i)}}catch(a){const c=Gs(a,`Initialization of query '${ge(t.query)}' failed`);return void t.onError(c)}e.queries.set(i,o),o.j_.push(t),t.Z_(e.onlineState),o.z_&&t.X_(o.z_)&&Qs(e)}async function Ws(n,t){const e=F(n),r=t.query;let i=3;const o=e.queries.get(r);if(o){const a=o.j_.indexOf(t);a>=0&&(o.j_.splice(a,1),o.j_.length===0?i=t.J_()?0:1:!o.H_()&&t.J_()&&(i=2))}switch(i){case 0:return e.queries.delete(r),e.onUnlisten(r,!0);case 1:return e.queries.delete(r),e.onUnlisten(r,!1);case 2:return e.onLastRemoteStoreUnlisten(r);default:return}}function hf(n,t){const e=F(n);let r=!1;for(const i of t){const o=i.query,a=e.queries.get(o);if(a){for(const c of a.j_)c.X_(i)&&(r=!0);a.z_=i}}r&&Qs(e)}function df(n,t,e){const r=F(n),i=r.queries.get(t);if(i)for(const o of i.j_)o.onError(e);r.queries.delete(t)}function Qs(n){n.Y_.forEach(t=>{t.next()})}var Es,Jo;(Jo=Es||(Es={})).ea="default",Jo.Cache="cache";class Hs{constructor(t,e,r){this.query=t,this.ta=e,this.na=!1,this.ra=null,this.onlineState="Unknown",this.options=r||{}}X_(t){if(!this.options.includeMetadataChanges){const r=[];for(const i of t.docChanges)i.type!==3&&r.push(i);t=new Pe(t.query,t.docs,t.oldDocs,r,t.mutatedKeys,t.fromCache,t.syncStateChanged,!0,t.hasCachedResults)}let e=!1;return this.na?this.ia(t)&&(this.ta.next(t),e=!0):this.sa(t,this.onlineState)&&(this.oa(t),e=!0),this.ra=t,e}onError(t){this.ta.error(t)}Z_(t){this.onlineState=t;let e=!1;return this.ra&&!this.na&&this.sa(this.ra,t)&&(this.oa(this.ra),e=!0),e}sa(t,e){if(!t.fromCache||!this.J_())return!0;const r=e!=="Offline";return(!this.options._a||!r)&&(!t.docs.isEmpty()||t.hasCachedResults||e==="Offline")}ia(t){if(t.docChanges.length>0)return!0;const e=this.ra&&this.ra.hasPendingWrites!==t.hasPendingWrites;return!(!t.syncStateChanged&&!e)&&this.options.includeMetadataChanges===!0}oa(t){t=Pe.fromInitialDocuments(t.query,t.docs,t.mutatedKeys,t.fromCache,t.hasCachedResults),this.na=!0,this.ta.next(t)}J_(){return this.options.source!==Es.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mu{constructor(t){this.key=t}}class gu{constructor(t){this.key=t}}class ff{constructor(t,e){this.query=t,this.Ta=e,this.Ea=null,this.hasCachedResults=!1,this.current=!1,this.da=U(),this.mutatedKeys=U(),this.Aa=Fa(t),this.Ra=new ve(this.Aa)}get Va(){return this.Ta}ma(t,e){const r=e?e.fa:new Yo,i=e?e.Ra:this.Ra;let o=e?e.mutatedKeys:this.mutatedKeys,a=i,c=!1;const h=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,f=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(t.inorderTraversal((p,I)=>{const w=i.get(p),V=hr(this.query,I)?I:null,D=!!w&&this.mutatedKeys.has(w.key),M=!!V&&(V.hasLocalMutations||this.mutatedKeys.has(V.key)&&V.hasCommittedMutations);let b=!1;w&&V?w.data.isEqual(V.data)?D!==M&&(r.track({type:3,doc:V}),b=!0):this.ga(w,V)||(r.track({type:2,doc:V}),b=!0,(h&&this.Aa(V,h)>0||f&&this.Aa(V,f)<0)&&(c=!0)):!w&&V?(r.track({type:0,doc:V}),b=!0):w&&!V&&(r.track({type:1,doc:w}),b=!0,(h||f)&&(c=!0)),b&&(V?(a=a.add(V),o=M?o.add(p):o.delete(p)):(a=a.delete(p),o=o.delete(p)))}),this.query.limit!==null)for(;a.size>this.query.limit;){const p=this.query.limitType==="F"?a.last():a.first();a=a.delete(p.key),o=o.delete(p.key),r.track({type:1,doc:p})}return{Ra:a,fa:r,ns:c,mutatedKeys:o}}ga(t,e){return t.hasLocalMutations&&e.hasCommittedMutations&&!e.hasLocalMutations}applyChanges(t,e,r,i){const o=this.Ra;this.Ra=t.Ra,this.mutatedKeys=t.mutatedKeys;const a=t.fa.G_();a.sort((p,I)=>function(V,D){const M=b=>{switch(b){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return x()}};return M(V)-M(D)}(p.type,I.type)||this.Aa(p.doc,I.doc)),this.pa(r),i=i!=null&&i;const c=e&&!i?this.ya():[],h=this.da.size===0&&this.current&&!i?1:0,f=h!==this.Ea;return this.Ea=h,a.length!==0||f?{snapshot:new Pe(this.query,t.Ra,o,a,t.mutatedKeys,h===0,f,!1,!!r&&r.resumeToken.approximateByteSize()>0),wa:c}:{wa:c}}Z_(t){return this.current&&t==="Offline"?(this.current=!1,this.applyChanges({Ra:this.Ra,fa:new Yo,mutatedKeys:this.mutatedKeys,ns:!1},!1)):{wa:[]}}Sa(t){return!this.Ta.has(t)&&!!this.Ra.has(t)&&!this.Ra.get(t).hasLocalMutations}pa(t){t&&(t.addedDocuments.forEach(e=>this.Ta=this.Ta.add(e)),t.modifiedDocuments.forEach(e=>{}),t.removedDocuments.forEach(e=>this.Ta=this.Ta.delete(e)),this.current=t.current)}ya(){if(!this.current)return[];const t=this.da;this.da=U(),this.Ra.forEach(r=>{this.Sa(r.key)&&(this.da=this.da.add(r.key))});const e=[];return t.forEach(r=>{this.da.has(r)||e.push(new gu(r))}),this.da.forEach(r=>{t.has(r)||e.push(new mu(r))}),e}ba(t){this.Ta=t.Ts,this.da=U();const e=this.ma(t.documents);return this.applyChanges(e,!0)}Da(){return Pe.fromInitialDocuments(this.query,this.Ra,this.mutatedKeys,this.Ea===0,this.hasCachedResults)}}class pf{constructor(t,e,r){this.query=t,this.targetId=e,this.view=r}}class mf{constructor(t){this.key=t,this.va=!1}}class gf{constructor(t,e,r,i,o,a){this.localStore=t,this.remoteStore=e,this.eventManager=r,this.sharedClientState=i,this.currentUser=o,this.maxConcurrentLimboResolutions=a,this.Ca={},this.Fa=new De(c=>La(c),cr),this.Ma=new Map,this.xa=new Set,this.Oa=new X(O.comparator),this.Na=new Map,this.La=new Ls,this.Ba={},this.ka=new Map,this.qa=Re.kn(),this.onlineState="Unknown",this.Qa=void 0}get isPrimaryClient(){return this.Qa===!0}}async function _f(n,t,e=!0){const r=Iu(n);let i;const o=r.Fa.get(t);return o?(r.sharedClientState.addLocalQueryTarget(o.targetId),i=o.view.Da()):i=await _u(r,t,e,!0),i}async function yf(n,t){const e=Iu(n);await _u(e,t,!0,!1)}async function _u(n,t,e,r){const i=await Ud(n.localStore,St(t)),o=i.targetId,a=n.sharedClientState.addLocalQueryTarget(o,e);let c;return r&&(c=await Ef(n,t,o,a==="current",i.resumeToken)),n.isPrimaryClient&&e&&lu(n.remoteStore,i),c}async function Ef(n,t,e,r,i){n.Ka=(I,w,V)=>async function(M,b,z,K){let Q=b.view.ma(z);Q.ns&&(Q=await Ko(M.localStore,b.query,!1).then(({documents:v})=>b.view.ma(v,Q)));const rt=K&&K.targetChanges.get(b.targetId),Nt=K&&K.targetMismatches.get(b.targetId)!=null,it=b.view.applyChanges(Q,M.isPrimaryClient,rt,Nt);return ta(M,b.targetId,it.wa),it.snapshot}(n,I,w,V);const o=await Ko(n.localStore,t,!0),a=new ff(t,o.Ts),c=a.ma(o.documents),h=En.createSynthesizedTargetChangeForCurrentChange(e,r&&n.onlineState!=="Offline",i),f=a.applyChanges(c,n.isPrimaryClient,h);ta(n,e,f.wa);const p=new pf(t,e,a);return n.Fa.set(t,p),n.Ma.has(e)?n.Ma.get(e).push(t):n.Ma.set(e,[t]),f.snapshot}async function vf(n,t,e){const r=F(n),i=r.Fa.get(t),o=r.Ma.get(i.targetId);if(o.length>1)return r.Ma.set(i.targetId,o.filter(a=>!cr(a,t))),void r.Fa.delete(t);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await ys(r.localStore,i.targetId,!1).then(()=>{r.sharedClientState.clearQueryState(i.targetId),e&&Bs(r.remoteStore,i.targetId),vs(r,i.targetId)}).catch(gn)):(vs(r,i.targetId),await ys(r.localStore,i.targetId,!0))}async function Tf(n,t){const e=F(n),r=e.Fa.get(t),i=e.Ma.get(r.targetId);e.isPrimaryClient&&i.length===1&&(e.sharedClientState.removeLocalQueryTarget(r.targetId),Bs(e.remoteStore,r.targetId))}async function If(n,t,e){const r=Cf(n);try{const i=await function(a,c){const h=F(a),f=nt.now(),p=c.reduce((V,D)=>V.add(D.key),U());let I,w;return h.persistence.runTransaction("Locally write mutations","readwrite",V=>{let D=Ut(),M=U();return h.cs.getEntries(V,p).next(b=>{D=b,D.forEach((z,K)=>{K.isValidDocument()||(M=M.add(z))})}).next(()=>h.localDocuments.getOverlayedDocuments(V,D)).next(b=>{I=b;const z=[];for(const K of c){const Q=$h(K,I.get(K.key).overlayedDocument);Q!=null&&z.push(new Jt(K.key,Q,Ca(Q.value.mapValue),Pt.exists(!0)))}return h.mutationQueue.addMutationBatch(V,f,z,c)}).next(b=>{w=b;const z=b.applyToLocalDocumentSet(I,M);return h.documentOverlayCache.saveOverlays(V,b.batchId,z)})}).then(()=>({batchId:w.batchId,changes:Ba(I)}))}(r.localStore,t);r.sharedClientState.addPendingMutation(i.batchId),function(a,c,h){let f=a.Ba[a.currentUser.toKey()];f||(f=new X($)),f=f.insert(c,h),a.Ba[a.currentUser.toKey()]=f}(r,i.batchId,e),await Tn(r,i.changes),await _r(r.remoteStore)}catch(i){const o=Gs(i,"Failed to persist write");e.reject(o)}}async function yu(n,t){const e=F(n);try{const r=await xd(e.localStore,t);t.targetChanges.forEach((i,o)=>{const a=e.Na.get(o);a&&(G(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1),i.addedDocuments.size>0?a.va=!0:i.modifiedDocuments.size>0?G(a.va):i.removedDocuments.size>0&&(G(a.va),a.va=!1))}),await Tn(e,r,t)}catch(r){await gn(r)}}function Zo(n,t,e){const r=F(n);if(r.isPrimaryClient&&e===0||!r.isPrimaryClient&&e===1){const i=[];r.Fa.forEach((o,a)=>{const c=a.view.Z_(t);c.snapshot&&i.push(c.snapshot)}),function(a,c){const h=F(a);h.onlineState=c;let f=!1;h.queries.forEach((p,I)=>{for(const w of I.j_)w.Z_(c)&&(f=!0)}),f&&Qs(h)}(r.eventManager,t),i.length&&r.Ca.d_(i),r.onlineState=t,r.isPrimaryClient&&r.sharedClientState.setOnlineState(t)}}async function Af(n,t,e){const r=F(n);r.sharedClientState.updateQueryState(t,"rejected",e);const i=r.Na.get(t),o=i&&i.key;if(o){let a=new X(O.comparator);a=a.insert(o,_t.newNoDocument(o,L.min()));const c=U().add(o),h=new pr(L.min(),new Map,new X($),a,c);await yu(r,h),r.Oa=r.Oa.remove(o),r.Na.delete(t),Ys(r)}else await ys(r.localStore,t,!1).then(()=>vs(r,t,e)).catch(gn)}async function wf(n,t){const e=F(n),r=t.batch.batchId;try{const i=await Od(e.localStore,t);vu(e,r,null),Eu(e,r),e.sharedClientState.updateMutationState(r,"acknowledged"),await Tn(e,i)}catch(i){await gn(i)}}async function Rf(n,t,e){const r=F(n);try{const i=await function(a,c){const h=F(a);return h.persistence.runTransaction("Reject batch","readwrite-primary",f=>{let p;return h.mutationQueue.lookupMutationBatch(f,c).next(I=>(G(I!==null),p=I.keys(),h.mutationQueue.removeMutationBatch(f,I))).next(()=>h.mutationQueue.performConsistencyCheck(f)).next(()=>h.documentOverlayCache.removeOverlaysForBatchId(f,p,c)).next(()=>h.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(f,p)).next(()=>h.localDocuments.getDocuments(f,p))})}(r.localStore,t);vu(r,t,e),Eu(r,t),r.sharedClientState.updateMutationState(t,"rejected",e),await Tn(r,i)}catch(i){await gn(i)}}function Eu(n,t){(n.ka.get(t)||[]).forEach(e=>{e.resolve()}),n.ka.delete(t)}function vu(n,t,e){const r=F(n);let i=r.Ba[r.currentUser.toKey()];if(i){const o=i.get(t);o&&(e?o.reject(e):o.resolve(),i=i.remove(t)),r.Ba[r.currentUser.toKey()]=i}}function vs(n,t,e=null){n.sharedClientState.removeLocalQueryTarget(t);for(const r of n.Ma.get(t))n.Fa.delete(r),e&&n.Ca.$a(r,e);n.Ma.delete(t),n.isPrimaryClient&&n.La.gr(t).forEach(r=>{n.La.containsKey(r)||Tu(n,r)})}function Tu(n,t){n.xa.delete(t.path.canonicalString());const e=n.Oa.get(t);e!==null&&(Bs(n.remoteStore,e),n.Oa=n.Oa.remove(t),n.Na.delete(e),Ys(n))}function ta(n,t,e){for(const r of e)r instanceof mu?(n.La.addReference(r.key,t),Pf(n,r)):r instanceof gu?(k("SyncEngine","Document no longer in limbo: "+r.key),n.La.removeReference(r.key,t),n.La.containsKey(r.key)||Tu(n,r.key)):x()}function Pf(n,t){const e=t.key,r=e.path.canonicalString();n.Oa.get(e)||n.xa.has(r)||(k("SyncEngine","New document in limbo: "+e),n.xa.add(r),Ys(n))}function Ys(n){for(;n.xa.size>0&&n.Oa.size<n.maxConcurrentLimboResolutions;){const t=n.xa.values().next().value;n.xa.delete(t);const e=new O(Y.fromString(t)),r=n.qa.next();n.Na.set(r,new mf(e)),n.Oa=n.Oa.insert(e,r),lu(n.remoteStore,new zt(St(lr(e.path)),r,"TargetPurposeLimboResolution",Ps.oe))}}async function Tn(n,t,e){const r=F(n),i=[],o=[],a=[];r.Fa.isEmpty()||(r.Fa.forEach((c,h)=>{a.push(r.Ka(h,t,e).then(f=>{var p;if((f||e)&&r.isPrimaryClient){const I=f?!f.fromCache:(p=e?.targetChanges.get(h.targetId))===null||p===void 0?void 0:p.current;r.sharedClientState.updateQueryState(h.targetId,I?"current":"not-current")}if(f){i.push(f);const I=Us.Wi(h.targetId,f);o.push(I)}}))}),await Promise.all(a),r.Ca.d_(i),await async function(h,f){const p=F(h);try{await p.persistence.runTransaction("notifyLocalViewChanges","readwrite",I=>S.forEach(f,w=>S.forEach(w.$i,V=>p.persistence.referenceDelegate.addReference(I,w.targetId,V)).next(()=>S.forEach(w.Ui,V=>p.persistence.referenceDelegate.removeReference(I,w.targetId,V)))))}catch(I){if(!_n(I))throw I;k("LocalStore","Failed to update sequence numbers: "+I)}for(const I of f){const w=I.targetId;if(!I.fromCache){const V=p.os.get(w),D=V.snapshotVersion,M=V.withLastLimboFreeSnapshotVersion(D);p.os=p.os.insert(w,M)}}}(r.localStore,o))}async function Vf(n,t){const e=F(n);if(!e.currentUser.isEqual(t)){k("SyncEngine","User change. New user:",t.toKey());const r=await iu(e.localStore,t);e.currentUser=t,function(o,a){o.ka.forEach(c=>{c.forEach(h=>{h.reject(new N(P.CANCELLED,a))})}),o.ka.clear()}(e,"'waitForPendingWrites' promise is rejected due to a user change."),e.sharedClientState.handleUserChange(t,r.removedBatchIds,r.addedBatchIds),await Tn(e,r.hs)}}function Sf(n,t){const e=F(n),r=e.Na.get(t);if(r&&r.va)return U().add(r.key);{let i=U();const o=e.Ma.get(t);if(!o)return i;for(const a of o){const c=e.Fa.get(a);i=i.unionWith(c.view.Va)}return i}}function Iu(n){const t=F(n);return t.remoteStore.remoteSyncer.applyRemoteEvent=yu.bind(null,t),t.remoteStore.remoteSyncer.getRemoteKeysForTarget=Sf.bind(null,t),t.remoteStore.remoteSyncer.rejectListen=Af.bind(null,t),t.Ca.d_=hf.bind(null,t.eventManager),t.Ca.$a=df.bind(null,t.eventManager),t}function Cf(n){const t=F(n);return t.remoteStore.remoteSyncer.applySuccessfulWrite=wf.bind(null,t),t.remoteStore.remoteSyncer.rejectFailedWrite=Rf.bind(null,t),t}class ir{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(t){this.serializer=mr(t.databaseInfo.databaseId),this.sharedClientState=this.Wa(t),this.persistence=this.Ga(t),await this.persistence.start(),this.localStore=this.za(t),this.gcScheduler=this.ja(t,this.localStore),this.indexBackfillerScheduler=this.Ha(t,this.localStore)}ja(t,e){return null}Ha(t,e){return null}za(t){return Md(this.persistence,new Nd,t.initialUser,this.serializer)}Ga(t){return new Cd(Fs.Zr,this.serializer)}Wa(t){return new qd}async terminate(){var t,e;(t=this.gcScheduler)===null||t===void 0||t.stop(),(e=this.indexBackfillerScheduler)===null||e===void 0||e.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}ir.provider={build:()=>new ir};class Ts{async initialize(t,e){this.localStore||(this.localStore=t.localStore,this.sharedClientState=t.sharedClientState,this.datastore=this.createDatastore(e),this.remoteStore=this.createRemoteStore(e),this.eventManager=this.createEventManager(e),this.syncEngine=this.createSyncEngine(e,!t.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Zo(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=Vf.bind(null,this.syncEngine),await uf(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(t){return function(){return new cf}()}createDatastore(t){const e=mr(t.databaseInfo.databaseId),r=function(o){return new Gd(o)}(t.databaseInfo);return function(o,a,c,h){return new Qd(o,a,c,h)}(t.authCredentials,t.appCheckCredentials,r,e)}createRemoteStore(t){return function(r,i,o,a,c){return new Yd(r,i,o,a,c)}(this.localStore,this.datastore,t.asyncQueue,e=>Zo(this.syncEngine,e,0),function(){return Qo.D()?new Qo:new jd}())}createSyncEngine(t,e){return function(i,o,a,c,h,f,p){const I=new gf(i,o,a,c,h,f);return p&&(I.Qa=!0),I}(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,t.initialUser,t.maxConcurrentLimboResolutions,e)}async terminate(){var t,e;await async function(i){const o=F(i);k("RemoteStore","RemoteStore shutting down."),o.L_.add(5),await vn(o),o.k_.shutdown(),o.q_.set("Unknown")}(this.remoteStore),(t=this.datastore)===null||t===void 0||t.terminate(),(e=this.eventManager)===null||e===void 0||e.terminate()}}Ts.provider={build:()=>new Ts};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xs{constructor(t){this.observer=t,this.muted=!1}next(t){this.muted||this.observer.next&&this.Ya(this.observer.next,t)}error(t){this.muted||(this.observer.error?this.Ya(this.observer.error,t):Ft("Uncaught Error in snapshot listener:",t.toString()))}Za(){this.muted=!0}Ya(t,e){setTimeout(()=>{this.muted||t(e)},0)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bf{constructor(t,e,r,i,o){this.authCredentials=t,this.appCheckCredentials=e,this.asyncQueue=r,this.databaseInfo=i,this.user=gt.UNAUTHENTICATED,this.clientId=Pa.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=o,this.authCredentials.start(r,async a=>{k("FirestoreClient","Received user=",a.uid),await this.authCredentialListener(a),this.user=a}),this.appCheckCredentials.start(r,a=>(k("FirestoreClient","Received new app check token=",a),this.appCheckCredentialListener(a,this.user)))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this.databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(t){this.authCredentialListener=t}setAppCheckTokenChangeListener(t){this.appCheckCredentialListener=t}terminate(){this.asyncQueue.enterRestrictedMode();const t=new xt;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted(async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),t.resolve()}catch(e){const r=Gs(e,"Failed to shutdown persistence");t.reject(r)}}),t.promise}}async function ts(n,t){n.asyncQueue.verifyOperationInProgress(),k("FirestoreClient","Initializing OfflineComponentProvider");const e=n.configuration;await t.initialize(e);let r=e.initialUser;n.setCredentialChangeListener(async i=>{r.isEqual(i)||(await iu(t.localStore,i),r=i)}),t.persistence.setDatabaseDeletedListener(()=>n.terminate()),n._offlineComponents=t}async function ea(n,t){n.asyncQueue.verifyOperationInProgress();const e=await Df(n);k("FirestoreClient","Initializing OnlineComponentProvider"),await t.initialize(e,n.configuration),n.setCredentialChangeListener(r=>Ho(t.remoteStore,r)),n.setAppCheckTokenChangeListener((r,i)=>Ho(t.remoteStore,i)),n._onlineComponents=t}async function Df(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){k("FirestoreClient","Using user provided OfflineComponentProvider");try{await ts(n,n._uninitializedComponentsProvider._offline)}catch(t){const e=t;if(!function(i){return i.name==="FirebaseError"?i.code===P.FAILED_PRECONDITION||i.code===P.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11}(e))throw e;Te("Error using user provided cache. Falling back to memory cache: "+e),await ts(n,new ir)}}else k("FirestoreClient","Using default OfflineComponentProvider"),await ts(n,new ir);return n._offlineComponents}async function Au(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(k("FirestoreClient","Using user provided OnlineComponentProvider"),await ea(n,n._uninitializedComponentsProvider._online)):(k("FirestoreClient","Using default OnlineComponentProvider"),await ea(n,new Ts))),n._onlineComponents}function Nf(n){return Au(n).then(t=>t.syncEngine)}async function or(n){const t=await Au(n),e=t.eventManager;return e.onListen=_f.bind(null,t.syncEngine),e.onUnlisten=vf.bind(null,t.syncEngine),e.onFirstRemoteStoreListen=yf.bind(null,t.syncEngine),e.onLastRemoteStoreUnlisten=Tf.bind(null,t.syncEngine),e}function kf(n,t,e={}){const r=new xt;return n.asyncQueue.enqueueAndForget(async()=>function(o,a,c,h,f){const p=new Xs({next:w=>{p.Za(),a.enqueueAndForget(()=>Ws(o,I));const V=w.docs.has(c);!V&&w.fromCache?f.reject(new N(P.UNAVAILABLE,"Failed to get document because the client is offline.")):V&&w.fromCache&&h&&h.source==="server"?f.reject(new N(P.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):f.resolve(w)},error:w=>f.reject(w)}),I=new Hs(lr(c.path),p,{includeMetadataChanges:!0,_a:!0});return Ks(o,I)}(await or(n),n.asyncQueue,t,e,r)),r.promise}function Mf(n,t,e={}){const r=new xt;return n.asyncQueue.enqueueAndForget(async()=>function(o,a,c,h,f){const p=new Xs({next:w=>{p.Za(),a.enqueueAndForget(()=>Ws(o,I)),w.fromCache&&h.source==="server"?f.reject(new N(P.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):f.resolve(w)},error:w=>f.reject(w)}),I=new Hs(c,p,{includeMetadataChanges:!0,_a:!0});return Ks(o,I)}(await or(n),n.asyncQueue,t,e,r)),r.promise}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wu(n){const t={};return n.timeoutSeconds!==void 0&&(t.timeoutSeconds=n.timeoutSeconds),t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const na=new Map;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ru(n,t,e){if(!e)throw new N(P.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${t}.`)}function Of(n,t,e,r){if(t===!0&&r===!0)throw new N(P.INVALID_ARGUMENT,`${n} and ${e} cannot be used together.`)}function ra(n){if(!O.isDocumentKey(n))throw new N(P.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function sa(n){if(O.isDocumentKey(n))throw new N(P.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function yr(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const t=function(r){return r.constructor?r.constructor.name:null}(n);return t?`a custom ${t} object`:"an object"}}return typeof n=="function"?"a function":x()}function wt(n,t){if("_delegate"in n&&(n=n._delegate),!(n instanceof t)){if(t.name===n.constructor.name)throw new N(P.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const e=yr(n);throw new N(P.INVALID_ARGUMENT,`Expected type '${t.name}', but it was: ${e}`)}}return n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ia{constructor(t){var e,r;if(t.host===void 0){if(t.ssl!==void 0)throw new N(P.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host="firestore.googleapis.com",this.ssl=!0}else this.host=t.host,this.ssl=(e=t.ssl)===null||e===void 0||e;if(this.credentials=t.credentials,this.ignoreUndefinedProperties=!!t.ignoreUndefinedProperties,this.localCache=t.localCache,t.cacheSizeBytes===void 0)this.cacheSizeBytes=41943040;else{if(t.cacheSizeBytes!==-1&&t.cacheSizeBytes<1048576)throw new N(P.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=t.cacheSizeBytes}Of("experimentalForceLongPolling",t.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",t.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!t.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:t.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!t.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=wu((r=t.experimentalLongPollingOptions)!==null&&r!==void 0?r:{}),function(o){if(o.timeoutSeconds!==void 0){if(isNaN(o.timeoutSeconds))throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (must not be NaN)`);if(o.timeoutSeconds<5)throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (minimum allowed value is 5)`);if(o.timeoutSeconds>30)throw new N(P.INVALID_ARGUMENT,`invalid long polling timeout: ${o.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!t.useFetchStreams}isEqual(t){return this.host===t.host&&this.ssl===t.ssl&&this.credentials===t.credentials&&this.cacheSizeBytes===t.cacheSizeBytes&&this.experimentalForceLongPolling===t.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===t.experimentalAutoDetectLongPolling&&function(r,i){return r.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,t.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===t.ignoreUndefinedProperties&&this.useFetchStreams===t.useFetchStreams}}class Er{constructor(t,e,r,i){this._authCredentials=t,this._appCheckCredentials=e,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new ia({}),this._settingsFrozen=!1,this._terminateTask="notTerminated"}get app(){if(!this._app)throw new N(P.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(t){if(this._settingsFrozen)throw new N(P.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new ia(t),t.credentials!==void 0&&(this._authCredentials=function(r){if(!r)return new Jc;switch(r.type){case"firstParty":return new nh(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new N(P.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}}(t.credentials))}_getSettings(){return this._settings}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(e){const r=na.get(e);r&&(k("ComponentProvider","Removing Datastore"),na.delete(e),r.terminate())}(this),Promise.resolve()}}function xf(n,t,e,r={}){var i;const o=(n=wt(n,Er))._getSettings(),a=`${t}:${e}`;if(o.host!=="firestore.googleapis.com"&&o.host!==a&&Te("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used."),n._setSettings(Object.assign(Object.assign({},o),{host:a,ssl:!1})),r.mockUserToken){let c,h;if(typeof r.mockUserToken=="string")c=r.mockUserToken,h=gt.MOCK_USER;else{c=bl(r.mockUserToken,(i=n._app)===null||i===void 0?void 0:i.options.projectId);const f=r.mockUserToken.sub||r.mockUserToken.user_id;if(!f)throw new N(P.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");h=new gt(f)}n._authCredentials=new Zc(new Ra(c,h))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zt{constructor(t,e,r){this.converter=e,this._query=r,this.type="query",this.firestore=t}withConverter(t){return new Zt(this.firestore,t,this._query)}}class yt{constructor(t,e,r){this.converter=e,this._key=r,this.type="document",this.firestore=t}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new Wt(this.firestore,this.converter,this._key.path.popLast())}withConverter(t){return new yt(this.firestore,t,this._key)}}class Wt extends Zt{constructor(t,e,r){super(t,e,lr(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const t=this._path.popLast();return t.isEmpty()?null:new yt(this.firestore,null,new O(t))}withConverter(t){return new Wt(this.firestore,t,this._path)}}function tp(n,t,...e){if(n=bt(n),Ru("collection","path",t),n instanceof Er){const r=Y.fromString(t,...e);return sa(r),new Wt(n,null,r)}{if(!(n instanceof yt||n instanceof Wt))throw new N(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(t,...e));return sa(r),new Wt(n.firestore,null,r)}}function ep(n,t,...e){if(n=bt(n),arguments.length===1&&(t=Pa.newId()),Ru("doc","path",t),n instanceof Er){const r=Y.fromString(t,...e);return ra(r),new yt(n,null,new O(r))}{if(!(n instanceof yt||n instanceof Wt))throw new N(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(Y.fromString(t,...e));return ra(r),new yt(n.firestore,n instanceof Wt?n.converter:null,new O(r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oa{constructor(t=Promise.resolve()){this.Pu=[],this.Iu=!1,this.Tu=[],this.Eu=null,this.du=!1,this.Au=!1,this.Ru=[],this.t_=new au(this,"async_queue_retry"),this.Vu=()=>{const r=Zr();r&&k("AsyncQueue","Visibility state changed to "+r.visibilityState),this.t_.jo()},this.mu=t;const e=Zr();e&&typeof e.addEventListener=="function"&&e.addEventListener("visibilitychange",this.Vu)}get isShuttingDown(){return this.Iu}enqueueAndForget(t){this.enqueue(t)}enqueueAndForgetEvenWhileRestricted(t){this.fu(),this.gu(t)}enterRestrictedMode(t){if(!this.Iu){this.Iu=!0,this.Au=t||!1;const e=Zr();e&&typeof e.removeEventListener=="function"&&e.removeEventListener("visibilitychange",this.Vu)}}enqueue(t){if(this.fu(),this.Iu)return new Promise(()=>{});const e=new xt;return this.gu(()=>this.Iu&&this.Au?Promise.resolve():(t().then(e.resolve,e.reject),e.promise)).then(()=>e.promise)}enqueueRetryable(t){this.enqueueAndForget(()=>(this.Pu.push(t),this.pu()))}async pu(){if(this.Pu.length!==0){try{await this.Pu[0](),this.Pu.shift(),this.t_.reset()}catch(t){if(!_n(t))throw t;k("AsyncQueue","Operation failed with retryable error: "+t)}this.Pu.length>0&&this.t_.Go(()=>this.pu())}}gu(t){const e=this.mu.then(()=>(this.du=!0,t().catch(r=>{this.Eu=r,this.du=!1;const i=function(a){let c=a.message||"";return a.stack&&(c=a.stack.includes(a.message)?a.stack:a.message+`
`+a.stack),c}(r);throw Ft("INTERNAL UNHANDLED ERROR: ",i),r}).then(r=>(this.du=!1,r))));return this.mu=e,e}enqueueAfterDelay(t,e,r){this.fu(),this.Ru.indexOf(t)>-1&&(e=0);const i=zs.createAndSchedule(this,t,e,r,o=>this.yu(o));return this.Tu.push(i),i}fu(){this.Eu&&x()}verifyOperationInProgress(){}async wu(){let t;do t=this.mu,await t;while(t!==this.mu)}Su(t){for(const e of this.Tu)if(e.timerId===t)return!0;return!1}bu(t){return this.wu().then(()=>{this.Tu.sort((e,r)=>e.targetTimeMs-r.targetTimeMs);for(const e of this.Tu)if(e.skipDelay(),t!=="all"&&e.timerId===t)break;return this.wu()})}Du(t){this.Ru.push(t)}yu(t){const e=this.Tu.indexOf(t);this.Tu.splice(e,1)}}function aa(n){return function(e,r){if(typeof e!="object"||e===null)return!1;const i=e;for(const o of r)if(o in i&&typeof i[o]=="function")return!0;return!1}(n,["next","error","complete"])}class Xt extends Er{constructor(t,e,r,i){super(t,e,r,i),this.type="firestore",this._queue=new oa,this._persistenceKey=i?.name||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const t=this._firestoreClient.terminate();this._queue=new oa(t),this._firestoreClient=void 0,await t}}}function np(n,t){const e=typeof n=="object"?n:Bc(),r=typeof n=="string"?n:"(default)",i=Oc(e,"firestore").getImmediate({identifier:r});if(!i._initialized){const o=Sl("firestore");o&&xf(i,...o)}return i}function vr(n){if(n._terminated)throw new N(P.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||Lf(n),n._firestoreClient}function Lf(n){var t,e,r;const i=n._freezeSettings(),o=function(c,h,f,p){return new mh(c,h,f,p.host,p.ssl,p.experimentalForceLongPolling,p.experimentalAutoDetectLongPolling,wu(p.experimentalLongPollingOptions),p.useFetchStreams)}(n._databaseId,((t=n._app)===null||t===void 0?void 0:t.options.appId)||"",n._persistenceKey,i);n._componentsProvider||!((e=i.localCache)===null||e===void 0)&&e._offlineComponentProvider&&(!((r=i.localCache)===null||r===void 0)&&r._onlineComponentProvider)&&(n._componentsProvider={_offline:i.localCache._offlineComponentProvider,_online:i.localCache._onlineComponentProvider}),n._firestoreClient=new bf(n._authCredentials,n._appCheckCredentials,n._queue,o,n._componentsProvider&&function(c){const h=c?._online.build();return{_offline:c?._offline.build(h),_online:h}}(n._componentsProvider))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ve{constructor(t){this._byteString=t}static fromBase64String(t){try{return new Ve(ct.fromBase64String(t))}catch(e){throw new N(P.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+e)}}static fromUint8Array(t){return new Ve(ct.fromUint8Array(t))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(t){return this._byteString.isEqual(t._byteString)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tr{constructor(...t){for(let e=0;e<t.length;++e)if(t[e].length===0)throw new N(P.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new ut(t)}isEqual(t){return this._internalPath.isEqual(t._internalPath)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Js{constructor(t){this._methodName=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zs{constructor(t,e){if(!isFinite(t)||t<-90||t>90)throw new N(P.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+t);if(!isFinite(e)||e<-180||e>180)throw new N(P.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+e);this._lat=t,this._long=e}get latitude(){return this._lat}get longitude(){return this._long}isEqual(t){return this._lat===t._lat&&this._long===t._long}toJSON(){return{latitude:this._lat,longitude:this._long}}_compareTo(t){return $(this._lat,t._lat)||$(this._long,t._long)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ti{constructor(t){this._values=(t||[]).map(e=>e)}toArray(){return this._values.map(t=>t)}isEqual(t){return function(r,i){if(r.length!==i.length)return!1;for(let o=0;o<r.length;++o)if(r[o]!==i[o])return!1;return!0}(this._values,t._values)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ff=/^__.*__$/;class Uf{constructor(t,e,r){this.data=t,this.fieldMask=e,this.fieldTransforms=r}toMutation(t,e){return this.fieldMask!==null?new Jt(t,this.data,this.fieldMask,e,this.fieldTransforms):new yn(t,this.data,e,this.fieldTransforms)}}class Pu{constructor(t,e,r){this.data=t,this.fieldMask=e,this.fieldTransforms=r}toMutation(t,e){return new Jt(t,this.data,this.fieldMask,e,this.fieldTransforms)}}function Vu(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw x()}}class ei{constructor(t,e,r,i,o,a){this.settings=t,this.databaseId=e,this.serializer=r,this.ignoreUndefinedProperties=i,o===void 0&&this.vu(),this.fieldTransforms=o||[],this.fieldMask=a||[]}get path(){return this.settings.path}get Cu(){return this.settings.Cu}Fu(t){return new ei(Object.assign(Object.assign({},this.settings),t),this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}Mu(t){var e;const r=(e=this.path)===null||e===void 0?void 0:e.child(t),i=this.Fu({path:r,xu:!1});return i.Ou(t),i}Nu(t){var e;const r=(e=this.path)===null||e===void 0?void 0:e.child(t),i=this.Fu({path:r,xu:!1});return i.vu(),i}Lu(t){return this.Fu({path:void 0,xu:!0})}Bu(t){return ar(t,this.settings.methodName,this.settings.ku||!1,this.path,this.settings.qu)}contains(t){return this.fieldMask.find(e=>t.isPrefixOf(e))!==void 0||this.fieldTransforms.find(e=>t.isPrefixOf(e.field))!==void 0}vu(){if(this.path)for(let t=0;t<this.path.length;t++)this.Ou(this.path.get(t))}Ou(t){if(t.length===0)throw this.Bu("Document fields must not be empty");if(Vu(this.Cu)&&Ff.test(t))throw this.Bu('Document fields cannot begin and end with "__"')}}class Bf{constructor(t,e,r){this.databaseId=t,this.ignoreUndefinedProperties=e,this.serializer=r||mr(t)}Qu(t,e,r,i=!1){return new ei({Cu:t,methodName:e,qu:r,path:ut.emptyPath(),xu:!1,ku:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function ni(n){const t=n._freezeSettings(),e=mr(n._databaseId);return new Bf(n._databaseId,!!t.ignoreUndefinedProperties,e)}function qf(n,t,e,r,i,o={}){const a=n.Qu(o.merge||o.mergeFields?2:0,t,e,i);ri("Data must be an object, but it was:",a,r);const c=Su(r,a);let h,f;if(o.merge)h=new At(a.fieldMask),f=a.fieldTransforms;else if(o.mergeFields){const p=[];for(const I of o.mergeFields){const w=Is(t,I,e);if(!a.contains(w))throw new N(P.INVALID_ARGUMENT,`Field '${w}' is specified in your field mask but missing from your input data.`);bu(p,w)||p.push(w)}h=new At(p),f=a.fieldTransforms.filter(I=>h.covers(I.field))}else h=null,f=a.fieldTransforms;return new Uf(new Tt(c),h,f)}class Ir extends Js{_toFieldTransform(t){if(t.Cu!==2)throw t.Cu===1?t.Bu(`${this._methodName}() can only appear at the top level of your update data`):t.Bu(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return t.fieldMask.push(t.path),null}isEqual(t){return t instanceof Ir}}function jf(n,t,e,r){const i=n.Qu(1,t,e);ri("Data must be an object, but it was:",i,r);const o=[],a=Tt.empty();ce(r,(h,f)=>{const p=si(t,h,e);f=bt(f);const I=i.Nu(p);if(f instanceof Ir)o.push(p);else{const w=In(f,I);w!=null&&(o.push(p),a.set(p,w))}});const c=new At(o);return new Pu(a,c,i.fieldTransforms)}function $f(n,t,e,r,i,o){const a=n.Qu(1,t,e),c=[Is(t,r,e)],h=[i];if(o.length%2!=0)throw new N(P.INVALID_ARGUMENT,`Function ${t}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let w=0;w<o.length;w+=2)c.push(Is(t,o[w])),h.push(o[w+1]);const f=[],p=Tt.empty();for(let w=c.length-1;w>=0;--w)if(!bu(f,c[w])){const V=c[w];let D=h[w];D=bt(D);const M=a.Nu(V);if(D instanceof Ir)f.push(V);else{const b=In(D,M);b!=null&&(f.push(V),p.set(V,b))}}const I=new At(f);return new Pu(p,I,a.fieldTransforms)}function zf(n,t,e,r=!1){return In(e,n.Qu(r?4:3,t))}function In(n,t){if(Cu(n=bt(n)))return ri("Unsupported field value:",t,n),Su(n,t);if(n instanceof Js)return function(r,i){if(!Vu(i.Cu))throw i.Bu(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.Bu(`${r._methodName}() is not currently supported inside arrays`);const o=r._toFieldTransform(i);o&&i.fieldTransforms.push(o)}(n,t),null;if(n===void 0&&t.ignoreUndefinedProperties)return null;if(t.path&&t.fieldMask.push(t.path),n instanceof Array){if(t.settings.xu&&t.Cu!==4)throw t.Bu("Nested arrays are not supported");return function(r,i){const o=[];let a=0;for(const c of r){let h=In(c,i.Lu(a));h==null&&(h={nullValue:"NULL_VALUE"}),o.push(h),a++}return{arrayValue:{values:o}}}(n,t)}return function(r,i){if((r=bt(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return Lh(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const o=nt.fromDate(r);return{timestampValue:rr(i.serializer,o)}}if(r instanceof nt){const o=new nt(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:rr(i.serializer,o)}}if(r instanceof Zs)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof Ve)return{bytesValue:Ja(i.serializer,r._byteString)};if(r instanceof yt){const o=i.databaseId,a=r.firestore._databaseId;if(!a.isEqual(o))throw i.Bu(`Document reference is for database ${a.projectId}/${a.database} but should be for database ${o.projectId}/${o.database}`);return{referenceValue:xs(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof ti)return function(a,c){return{mapValue:{fields:{__type__:{stringValue:"__vector__"},value:{arrayValue:{values:a.toArray().map(h=>{if(typeof h!="number")throw c.Bu("VectorValues must only contain numeric values.");return Ns(c.serializer,h)})}}}}}}(r,i);throw i.Bu(`Unsupported field value: ${yr(r)}`)}(n,t)}function Su(n,t){const e={};return Va(n)?t.path&&t.path.length>0&&t.fieldMask.push(t.path):ce(n,(r,i)=>{const o=In(i,t.Mu(r));o!=null&&(e[r]=o)}),{mapValue:{fields:e}}}function Cu(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof nt||n instanceof Zs||n instanceof Ve||n instanceof yt||n instanceof Js||n instanceof ti)}function ri(n,t,e){if(!Cu(e)||!function(i){return typeof i=="object"&&i!==null&&(Object.getPrototypeOf(i)===Object.prototype||Object.getPrototypeOf(i)===null)}(e)){const r=yr(e);throw r==="an object"?t.Bu(n+" a custom object"):t.Bu(n+" "+r)}}function Is(n,t,e){if((t=bt(t))instanceof Tr)return t._internalPath;if(typeof t=="string")return si(n,t);throw ar("Field path arguments must be of type string or ",n,!1,void 0,e)}const Gf=new RegExp("[~\\*/\\[\\]]");function si(n,t,e){if(t.search(Gf)>=0)throw ar(`Invalid field path (${t}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,e);try{return new Tr(...t.split("."))._internalPath}catch{throw ar(`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,e)}}function ar(n,t,e,r,i){const o=r&&!r.isEmpty(),a=i!==void 0;let c=`Function ${t}() called with invalid data`;e&&(c+=" (via `toFirestore()`)"),c+=". ";let h="";return(o||a)&&(h+=" (found",o&&(h+=` in field ${r}`),a&&(h+=` in document ${i}`),h+=")"),new N(P.INVALID_ARGUMENT,c+n+h)}function bu(n,t){return n.some(e=>e.isEqual(t))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Du{constructor(t,e,r,i,o){this._firestore=t,this._userDataWriter=e,this._key=r,this._document=i,this._converter=o}get id(){return this._key.path.lastSegment()}get ref(){return new yt(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const t=new Kf(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(t)}return this._userDataWriter.convertValue(this._document.data.value)}}get(t){if(this._document){const e=this._document.data.field(ii("DocumentSnapshot.get",t));if(e!==null)return this._userDataWriter.convertValue(e)}}}class Kf extends Du{data(){return super.data()}}function ii(n,t){return typeof t=="string"?si(n,t):t instanceof Tr?t._internalPath:t._delegate._internalPath}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Nu(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new N(P.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class oi{}class ku extends oi{}function rp(n,t,...e){let r=[];t instanceof oi&&r.push(t),r=r.concat(e),function(o){const a=o.filter(h=>h instanceof ui).length,c=o.filter(h=>h instanceof ai).length;if(a>1||a>0&&c>0)throw new N(P.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")}(r);for(const i of r)n=i._apply(n);return n}class ai extends ku{constructor(t,e,r){super(),this._field=t,this._op=e,this._value=r,this.type="where"}static _create(t,e,r){return new ai(t,e,r)}_apply(t){const e=this._parse(t);return Mu(t._query,e),new Zt(t.firestore,t.converter,ds(t._query,e))}_parse(t){const e=ni(t.firestore);return function(o,a,c,h,f,p,I){let w;if(f.isKeyField()){if(p==="array-contains"||p==="array-contains-any")throw new N(P.INVALID_ARGUMENT,`Invalid Query. You can't perform '${p}' queries on documentId().`);if(p==="in"||p==="not-in"){la(I,p);const V=[];for(const D of I)V.push(ua(h,o,D));w={arrayValue:{values:V}}}else w=ua(h,o,I)}else p!=="in"&&p!=="not-in"&&p!=="array-contains-any"||la(I,p),w=zf(c,a,I,p==="in"||p==="not-in");return et.create(f,p,w)}(t._query,"where",e,t.firestore._databaseId,this._field,this._op,this._value)}}class ui extends oi{constructor(t,e){super(),this.type=t,this._queryConstraints=e}static _create(t,e){return new ui(t,e)}_parse(t){const e=this._queryConstraints.map(r=>r._parse(t)).filter(r=>r.getFilters().length>0);return e.length===1?e[0]:Vt.create(e,this._getOperator())}_apply(t){const e=this._parse(t);return e.getFilters().length===0?t:(function(i,o){let a=i;const c=o.getFlattenedFilters();for(const h of c)Mu(a,h),a=ds(a,h)}(t._query,e),new Zt(t.firestore,t.converter,ds(t._query,e)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}class li extends ku{constructor(t,e){super(),this._field=t,this._direction=e,this.type="orderBy"}static _create(t,e){return new li(t,e)}_apply(t){const e=function(i,o,a){if(i.startAt!==null)throw new N(P.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(i.endAt!==null)throw new N(P.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new fn(o,a)}(t._query,this._field,this._direction);return new Zt(t.firestore,t.converter,function(i,o){const a=i.explicitOrderBy.concat([o]);return new be(i.path,i.collectionGroup,a,i.filters.slice(),i.limit,i.limitType,i.startAt,i.endAt)}(t._query,e))}}function sp(n,t="asc"){const e=t,r=ii("orderBy",n);return li._create(r,e)}function ua(n,t,e){if(typeof(e=bt(e))=="string"){if(e==="")throw new N(P.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!xa(t)&&e.indexOf("/")!==-1)throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${e}' contains a '/' character.`);const r=t.path.child(Y.fromString(e));if(!O.isDocumentKey(r))throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return Co(n,new O(r))}if(e instanceof yt)return Co(n,e._key);throw new N(P.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${yr(e)}.`)}function la(n,t){if(!Array.isArray(n)||n.length===0)throw new N(P.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${t.toString()}' filters.`)}function Mu(n,t){const e=function(i,o){for(const a of i)for(const c of a.getFlattenedFilters())if(o.indexOf(c.op)>=0)return c.op;return null}(n.filters,function(i){switch(i){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}}(t.op));if(e!==null)throw e===t.op?new N(P.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${t.op.toString()}' filter.`):new N(P.INVALID_ARGUMENT,`Invalid query. You cannot use '${t.op.toString()}' filters with '${e.toString()}' filters.`)}class Wf{convertValue(t,e="none"){switch(le(t)){case 0:return null;case 1:return t.booleanValue;case 2:return Z(t.integerValue||t.doubleValue);case 3:return this.convertTimestamp(t.timestampValue);case 4:return this.convertServerTimestamp(t,e);case 5:return t.stringValue;case 6:return this.convertBytes(ue(t.bytesValue));case 7:return this.convertReference(t.referenceValue);case 8:return this.convertGeoPoint(t.geoPointValue);case 9:return this.convertArray(t.arrayValue,e);case 11:return this.convertObject(t.mapValue,e);case 10:return this.convertVectorValue(t.mapValue);default:throw x()}}convertObject(t,e){return this.convertObjectMap(t.fields,e)}convertObjectMap(t,e="none"){const r={};return ce(t,(i,o)=>{r[i]=this.convertValue(o,e)}),r}convertVectorValue(t){var e,r,i;const o=(i=(r=(e=t.fields)===null||e===void 0?void 0:e.value.arrayValue)===null||r===void 0?void 0:r.values)===null||i===void 0?void 0:i.map(a=>Z(a.doubleValue));return new ti(o)}convertGeoPoint(t){return new Zs(Z(t.latitude),Z(t.longitude))}convertArray(t,e){return(t.values||[]).map(r=>this.convertValue(r,e))}convertServerTimestamp(t,e){switch(e){case"previous":const r=Ss(t);return r==null?null:this.convertValue(r,e);case"estimate":return this.convertTimestamp(cn(t));default:return null}}convertTimestamp(t){const e=Ht(t);return new nt(e.seconds,e.nanos)}convertDocumentKey(t,e){const r=Y.fromString(t);G(su(r));const i=new hn(r.get(1),r.get(3)),o=new O(r.popFirst(5));return i.isEqual(e)||Ft(`Document ${o} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${e.projectId}/${e.database}) instead.`),o}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qf(n,t,e){let r;return r=n?e&&(e.merge||e.mergeFields)?n.toFirestore(t,e):n.toFirestore(t):t,r}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tn{constructor(t,e){this.hasPendingWrites=t,this.fromCache=e}isEqual(t){return this.hasPendingWrites===t.hasPendingWrites&&this.fromCache===t.fromCache}}class Ou extends Du{constructor(t,e,r,i,o,a){super(t,e,r,i,a),this._firestore=t,this._firestoreImpl=t,this.metadata=o}exists(){return super.exists()}data(t={}){if(this._document){if(this._converter){const e=new Yn(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(e,t)}return this._userDataWriter.convertValue(this._document.data.value,t.serverTimestamps)}}get(t,e={}){if(this._document){const r=this._document.data.field(ii("DocumentSnapshot.get",t));if(r!==null)return this._userDataWriter.convertValue(r,e.serverTimestamps)}}}class Yn extends Ou{data(t={}){return super.data(t)}}class xu{constructor(t,e,r,i){this._firestore=t,this._userDataWriter=e,this._snapshot=i,this.metadata=new tn(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const t=[];return this.forEach(e=>t.push(e)),t}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(t,e){this._snapshot.docs.forEach(r=>{t.call(e,new Yn(this._firestore,this._userDataWriter,r.key,r,new tn(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))})}docChanges(t={}){const e=!!t.includeMetadataChanges;if(e&&this._snapshot.excludesMetadataChanges)throw new N(P.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===e||(this._cachedChanges=function(i,o){if(i._snapshot.oldDocs.isEmpty()){let a=0;return i._snapshot.docChanges.map(c=>{const h=new Yn(i._firestore,i._userDataWriter,c.doc.key,c.doc,new tn(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);return c.doc,{type:"added",doc:h,oldIndex:-1,newIndex:a++}})}{let a=i._snapshot.oldDocs;return i._snapshot.docChanges.filter(c=>o||c.type!==3).map(c=>{const h=new Yn(i._firestore,i._userDataWriter,c.doc.key,c.doc,new tn(i._snapshot.mutatedKeys.has(c.doc.key),i._snapshot.fromCache),i.query.converter);let f=-1,p=-1;return c.type!==0&&(f=a.indexOf(c.doc.key),a=a.delete(c.doc.key)),c.type!==1&&(a=a.add(c.doc),p=a.indexOf(c.doc.key)),{type:Hf(c.type),doc:h,oldIndex:f,newIndex:p}})}}(this,e),this._cachedChangesIncludeMetadataChanges=e),this._cachedChanges}}function Hf(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return x()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ip(n){n=wt(n,yt);const t=wt(n.firestore,Xt);return kf(vr(t),n._key).then(e=>Lu(t,n,e))}class ci extends Wf{constructor(t){super(),this.firestore=t}convertBytes(t){return new Ve(t)}convertReference(t){const e=this.convertDocumentKey(t,this.firestore._databaseId);return new yt(this.firestore,null,e)}}function op(n){n=wt(n,Zt);const t=wt(n.firestore,Xt),e=vr(t),r=new ci(t);return Nu(n._query),Mf(e,n._query).then(i=>new xu(t,r,n,i))}function ap(n,t,e){n=wt(n,yt);const r=wt(n.firestore,Xt),i=Qf(n.converter,t,e);return hi(r,[qf(ni(r),"setDoc",n._key,i,n.converter!==null,e).toMutation(n._key,Pt.none())])}function up(n,t,e,...r){n=wt(n,yt);const i=wt(n.firestore,Xt),o=ni(i);let a;return a=typeof(t=bt(t))=="string"||t instanceof Tr?$f(o,"updateDoc",n._key,t,e,r):jf(o,"updateDoc",n._key,t),hi(i,[a.toMutation(n._key,Pt.exists(!0))])}function lp(n){return hi(wt(n.firestore,Xt),[new ks(n._key,Pt.none())])}function cp(n,...t){var e,r,i;n=bt(n);let o={includeMetadataChanges:!1,source:"default"},a=0;typeof t[a]!="object"||aa(t[a])||(o=t[a],a++);const c={includeMetadataChanges:o.includeMetadataChanges,source:o.source};if(aa(t[a])){const I=t[a];t[a]=(e=I.next)===null||e===void 0?void 0:e.bind(I),t[a+1]=(r=I.error)===null||r===void 0?void 0:r.bind(I),t[a+2]=(i=I.complete)===null||i===void 0?void 0:i.bind(I)}let h,f,p;if(n instanceof yt)f=wt(n.firestore,Xt),p=lr(n._key.path),h={next:I=>{t[a]&&t[a](Lu(f,n,I))},error:t[a+1],complete:t[a+2]};else{const I=wt(n,Zt);f=wt(I.firestore,Xt),p=I._query;const w=new ci(f);h={next:V=>{t[a]&&t[a](new xu(f,w,I,V))},error:t[a+1],complete:t[a+2]},Nu(n._query)}return function(w,V,D,M){const b=new Xs(M),z=new Hs(V,b,D);return w.asyncQueue.enqueueAndForget(async()=>Ks(await or(w),z)),()=>{b.Za(),w.asyncQueue.enqueueAndForget(async()=>Ws(await or(w),z))}}(vr(f),p,c,h)}function hi(n,t){return function(r,i){const o=new xt;return r.asyncQueue.enqueueAndForget(async()=>If(await Nf(r),i,o)),o.promise}(vr(n),t)}function Lu(n,t,e){const r=e.docs.get(t._key),i=new ci(n);return new Ou(n,i,t._key,r,new tn(e.hasPendingWrites,e.fromCache),t.converter)}(function(t,e=!0){(function(i){Ce=i})(Fc),Jn(new on("firestore",(r,{instanceIdentifier:i,options:o})=>{const a=r.getProvider("app").getImmediate(),c=new Xt(new th(r.getProvider("auth-internal")),new sh(r.getProvider("app-check-internal")),function(f,p){if(!Object.prototype.hasOwnProperty.apply(f.options,["projectId"]))throw new N(P.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new hn(f.options.projectId,p)}(a,i),a);return o=Object.assign({useFetchStreams:e},o),c._setSettings(o),c},"PUBLIC").setMultipleInstances(!0)),Ee(wo,"4.7.3",t),Ee(wo,"4.7.3","esm2017")})();export{np as a,cp as b,tp as c,ep as d,ip as e,op as f,Yf as g,lp as h,Uc as i,sp as o,rp as q,ap as s,up as u};

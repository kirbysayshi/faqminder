import { FAQ_CLIP_MARKER } from "~/lib/filename";

// The bookmarklet we show the user to install in their browser. Run on a GameFAQs
// FAQ page it grabs `.faqtext`, prepends the machine header (marker + page title)
// that `parsePastedFaq` strips back off, and copies the result to the clipboard.
//
// Copy strategy is WebKit/iOS-Firefox-first: synchronous `execCommand("copy")` off a
// hidden <textarea> runs inside the tap gesture (reliable in WebKit); async
// `clipboard.writeText` is only the fallback, because a bookmarklet is a tick removed
// from the gesture and WebKit may reject the async write. `.faqtext` via jQuery when
// the page has it (GameFAQs does), else querySelectorAll. Newlines/tabs are escaped
// so the emitted string is valid one-line bookmarklet source.
export const BOOKMARKLET =
  "javascript:(function(){" +
  `var m=${JSON.stringify(FAQ_CLIP_MARKER)},` +
  'b=window.jQuery?jQuery(".faqtext").text():Array.prototype.map.call(document.querySelectorAll(".faqtext"),function(e){return e.textContent}).join("\\n");' +
  'if(!b){alert("FAQMinder: no FAQ text (.faqtext) found on this page.");return}' +
  'var p=m+"\\t"+document.title+"\\n"+b;' +
  'function toast(s){var d=document.createElement("div");d.textContent=s;d.style.cssText="position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#0a0a0a;color:#fff;font:14px -apple-system,system-ui,sans-serif;padding:12px 16px;text-align:center";document.documentElement.appendChild(d);setTimeout(function(){d.remove()},2600)}' +
  'var t=document.createElement("textarea");t.value=p;t.readOnly=true;t.style.cssText="position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";document.body.appendChild(t);t.focus();t.select();try{t.setSelectionRange(0,p.length)}catch(e){}var ok=false;try{ok=document.execCommand("copy")}catch(e){}t.remove();' +
  'if(ok){toast("FAQ copied \\u2713  Open FAQMinder \\u2192 Paste")}' +
  'else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(p).then(function(){toast("FAQ copied \\u2713  Open FAQMinder \\u2192 Paste")},function(){alert("FAQMinder: couldn\'t copy to the clipboard.")})}' +
  'else{alert("FAQMinder: clipboard unavailable in this browser.")}' +
  "})();";

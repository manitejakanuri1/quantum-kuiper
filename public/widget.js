/**
 * Talk to Site — Embeddable Widget Loader
 *
 * Usage: Add this script tag to any webpage:
 * <script src="https://yourapp.com/widget.js" data-agent-id="YOUR_AGENT_ID"></script>
 *
 * Optional attributes:
 * - data-position: "bottom-right" (default) or "bottom-left"
 * - data-color: hex color for the button (default: agent's widget_color)
 * - data-title: tooltip text (default: agent's widget_title)
 */
(function () {
  'use strict';

  // Prevent double initialization
  if (window.__ttsWidgetLoaded) return;
  window.__ttsWidgetLoaded = true;

  // Find the script tag to get config
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var agentId = script.getAttribute('data-agent-id');
  if (!agentId) {
    console.error('[TalkToSite] Missing data-agent-id attribute');
    return;
  }

  // Validate agentId format (UUID only — prevent XSS via data attributes)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId)) {
    console.error('[TalkToSite] Invalid agent ID format');
    return;
  }

  // Get the base URL from the script src
  var baseUrl = script.src.replace(/\/widget\.js.*$/, '');

  // Optional overrides from data attributes (validated)
  var positionOverride = script.getAttribute('data-position');
  if (positionOverride && positionOverride !== 'bottom-right' && positionOverride !== 'bottom-left') {
    positionOverride = null; // Reject invalid position values
  }
  var colorOverride = script.getAttribute('data-color');
  if (colorOverride && !/^#[0-9A-Fa-f]{6}$/.test(colorOverride)) {
    colorOverride = null; // Reject invalid hex colors (prevent CSS injection)
  }
  var titleOverride = script.getAttribute('data-title');
  if (titleOverride) {
    // Strip HTML tags to prevent XSS via title attribute
    titleOverride = titleOverride.replace(/<[^>]*>/g, '').slice(0, 100);
  }

  // State
  var isOpen = false;
  var container = null;
  var button = null;
  var iframe = null;
  var config = null;

  // Fetch agent config
  function fetchConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', baseUrl + '/api/widget/' + agentId);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          config = JSON.parse(xhr.responseText);
          // Apply overrides
          if (positionOverride) config.widget_position = positionOverride;
          if (colorOverride) config.widget_color = colorOverride;
          if (titleOverride) config.widget_title = titleOverride;
          callback(null, config);
        } catch (e) {
          callback(e);
        }
      } else {
        callback(new Error('Failed to load agent config: ' + xhr.status));
      }
    };
    xhr.onerror = function () {
      callback(new Error('Network error loading agent config'));
    };
    xhr.send();
  }

  // Create the floating button
  function createButton() {
    button = document.createElement('div');
    button.id = 'tts-widget-button';

    var isRight = config.widget_position !== 'bottom-left';
    var color = config.widget_color || '#F97316';

    button.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      isRight ? 'right: 24px' : 'left: 24px',
      'width: 56px',
      'height: 56px',
      'border-radius: 50%',
      'background: ' + color,
      'cursor: pointer',
      'z-index: 2147483646',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'box-shadow: 0 4px 20px rgba(0,0,0,0.3)',
      'transition: transform 0.2s, box-shadow 0.2s',
    ].join(';');

    // Chat icon SVG
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    button.title = config.widget_title || 'Chat with us';

    button.onmouseenter = function () {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 24px rgba(0,0,0,0.4)';
    };
    button.onmouseleave = function () {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    };

    button.onclick = function () {
      toggleWidget();
    };

    document.body.appendChild(button);
  }

  // Create the widget container + iframe
  function createWidget() {
    var isRight = config.widget_position !== 'bottom-left';

    container = document.createElement('div');
    container.id = 'tts-widget-container';
    container.style.cssText = [
      'position: fixed',
      'bottom: 100px',
      isRight ? 'right: 24px' : 'left: 24px',
      'width: 370px',
      'height: 520px',
      'border-radius: 16px',
      'overflow: hidden',
      'z-index: 2147483647',
      'box-shadow: 0 8px 40px rgba(0,0,0,0.4)',
      'display: none',
      'opacity: 0',
      'transform: translateY(20px) scale(0.95)',
      'transition: opacity 0.3s, transform 0.3s',
    ].join(';');

    iframe = document.createElement('iframe');
    iframe.src = baseUrl + '/widget/' + agentId;
    iframe.style.cssText = [
      'width: 100%',
      'height: 100%',
      'border: none',
      'background: #0D0D0D',
      'border-radius: 16px',
    ].join(';');
    iframe.allow = 'microphone; autoplay';
    iframe.referrerPolicy = 'strict-origin';
    // Sandbox: allow scripts + same-origin (for Supabase/API calls) + microphone + popups for OAuth
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';
    iframe.title = config.widget_title || 'Chat Widget';

    container.appendChild(iframe);
    document.body.appendChild(container);
  }

  // Toggle open/close
  function toggleWidget() {
    if (isOpen) {
      closeWidget();
    } else {
      openWidget();
    }
  }

  function openWidget() {
    if (!container) createWidget();

    container.style.display = 'block';
    // Force reflow for animation
    container.offsetHeight; // eslint-disable-line no-unused-expressions
    container.style.opacity = '1';
    container.style.transform = 'translateY(0) scale(1)';

    // Change button to X icon
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    isOpen = true;
  }

  function closeWidget() {
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px) scale(0.95)';

    setTimeout(function () {
      container.style.display = 'none';
    }, 300);

    // Change button back to chat icon
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    isOpen = false;
  }

  // Listen for close message from iframe (validate origin)
  window.addEventListener('message', function (event) {
    // Only accept messages from our own widget iframe
    if (event.origin !== new URL(baseUrl).origin) return;
    if (event.data && event.data.type === 'tts-widget-close') {
      closeWidget();
    }
  });

  // Initialize
  fetchConfig(function (err) {
    if (err) {
      console.error('[TalkToSite] ' + err.message);
      return;
    }
    createButton();
  });
})();

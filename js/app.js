/**
 * Encrypted DNS Profile Generator
 * Generates iOS 14+ / macOS 11+ .mobileconfig configurations
 */

(function() {
  'use strict';

  // ========================================
  // Utility Functions
  // ========================================

  /**
   * Generate a UUID v4
   * @returns {string} Formatted UUID
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).toUpperCase();
  }

  /**
   * Sanitize string for XML output
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  function sanitizeXML(str) {
    return String(str || '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Show status message
   * @param {string} message - Message to display
   * @param {'success'|'error'} type - Message type
   */
  function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type} visible`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusEl.classList.remove('visible');
    }, 5000);
  }

  /**
   * Hide status message
   */
  function hideStatus() {
    const statusEl = document.getElementById('status');
    statusEl.classList.remove('visible');
  }

  // ========================================
  // Form Data Management
  // ========================================

  /**
   * Get current form data
   * @returns {Object} Form data object
   */
  function getFormData() {
    const protocol = document.querySelector('input[name="protocol"]:checked')?.value || 'HTTPS';
    return {
      name: document.getElementById('profileName')?.value.trim() || 'My Secure DNS',
      org: document.getElementById('organization')?.value.trim() || '',
      id: document.getElementById('identifier')?.value.trim() || 'com.example.dns',
      protocol: protocol,
      serverUrl: document.getElementById('serverUrl')?.value.trim() || '',
      serverName: document.getElementById('serverName')?.value.trim() || '',
      serverAddrs: document.getElementById('serverAddresses')?.value.trim() || '',
      useOnDemand: document.getElementById('useOnDemand')?.checked || true
    };
  }

  // ========================================
  // XML/Plist Generation
  // ========================================

  /**
   * Build the mobileconfig plist XML
   * @param {Object} data - Form data
   * @returns {string} XML content
   */
  function buildPlist(data) {
    const profileUUID = generateUUID();
    const payloadUUID = generateUUID();
    const payloadIdentifier = `${sanitizeXML(data.id)}.${payloadUUID}`;

    let protocolSpecificConfig = '';

    if (data.protocol === 'HTTPS') {
      protocolSpecificConfig = `
      <key>DNSProtocol</key>
      <string>HTTPS</string>
      <key>ServerURL</key>
      <string>${sanitizeXML(data.serverUrl || 'https://dns.example.com/dns-query')}</string>`;
    } else {
      let addressesXml = '';
      if (data.serverAddrs) {
        const addrs = data.serverAddrs.split(',').map(s => s.trim()).filter(Boolean);
        if (addrs.length > 0) {
          addressesXml = `
      <key>ServerAddresses</key>
      <array>` +
            addrs.map(ip => `
        <string>${sanitizeXML(ip)}</string>`).join('') + `
      </array>`;
        }
      }
      protocolSpecificConfig = `
      <key>DNSProtocol</key>
      <string>TLS</string>
      <key>ServerName</key>
      <string>${sanitizeXML(data.serverName || 'dns.example.com')}</string>${addressesXml}`;
    }

    const onDemandBlock = data.useOnDemand ? `
      <key>OnDemandRules</key>
      <array>
        <dict>
          <key>Action</key>
          <string>Connect</string>
        </dict>
      </array>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>${protocolSpecificConfig}
      </dict>${onDemandBlock}
      <key>PayloadDescription</key>
      <string>Configures Encrypted DNS</string>
      <key>PayloadDisplayName</key>
      <string>${sanitizeXML(data.name)}</string>
      <key>PayloadIdentifier</key>
      <string>${payloadIdentifier}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${payloadUUID}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Encrypted DNS configuration profile.</string>
  <key>PayloadDisplayName</key>
  <string>${sanitizeXML(data.name)}</string>
  <key>PayloadIdentifier</key>
  <string>${sanitizeXML(data.id)}.profile</string>
  <key>PayloadOrganization</key>
  <string>${sanitizeXML(data.org)}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
  }

  // ========================================
  // UI Rendering
  // ========================================

  /**
   * Update preview panel with current XML
   */
  function updatePreview() {
    const previewEl = document.getElementById('preview');
    const data = getFormData();
    const xml = buildPlist(data);
    if (previewEl) {
      previewEl.textContent = xml;
    }
    hideStatus();
  }

  /**
   * Toggle protocol-specific fields
   * @param {string} protocol - 'HTTPS' or 'TLS'
   */
  function toggleProtocolFields(protocol) {
    const dohFields = document.getElementById('dohFields');
    const dotFields = document.getElementById('dotFields');

    if (protocol === 'HTTPS') {
      dohFields?.classList.add('active');
      dotFields?.classList.remove('active');
    } else {
      dohFields?.classList.remove('active');
      dotFields?.classList.add('active');
    }
  }

  // ========================================
  // Actions
  // ========================================

  /**
   * Handle form submission - download profile
   * @param {Event} e - Submit event
   */
  function handleDownload(e) {
    e.preventDefault();
    const data = getFormData();

    // Validate required fields based on protocol
    if (data.protocol === 'HTTPS' && !data.serverUrl) {
      showStatus('Error: DoH Server URL is required.', 'error');
      return;
    }
    if (data.protocol === 'TLS' && !data.serverName) {
      showStatus('Error: DoT Server Name is required.', 'error');
      return;
    }

    const xml = buildPlist(data);
    const blob = new Blob([xml], { type: 'application/x-apple-aspen-config' });
    const filename = data.name.replace(/[^a-z0-9_-]/gi, '_') + '.mobileconfig';

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Cleanup
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);

    showStatus('✓ Profile downloaded successfully!', 'success');
  }

  /**
   * Handle copy to clipboard
   * @param {Event} e - Click event
   */
  function handleCopy(e) {
    e.preventDefault();
    const previewEl = document.getElementById('preview');
    if (!previewEl) return;

    navigator.clipboard.writeText(previewEl.textContent).then(() => {
      showStatus('✓ XML copied to clipboard!', 'success');
    }).catch(() => {
      showStatus('Error: Failed to copy to clipboard.', 'error');
    });
  }

  // ========================================
  // Theme Management
  // ========================================

  /**
   * Initialize theme from localStorage or system preference
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  /**
   * Toggle between light and dark theme
   */
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  // ========================================
  // Event Listeners Setup
  // ========================================

  /**
   * Initialize all event listeners
   */
  function initEventListeners() {
    const form = document.getElementById('profileForm');
    const protocolRadios = document.querySelectorAll('input[name="protocol"]');
    const copyBtn = document.getElementById('copyBtn');
    const themeToggle = document.getElementById('themeToggle');

    // Protocol radio buttons
    protocolRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        toggleProtocolFields(e.target.value);
        updatePreview();
      });
    });

    // Form input changes
    form?.addEventListener('input', updatePreview);

    // Form submission
    form?.addEventListener('submit', handleDownload);

    // Copy button
    copyBtn?.addEventListener('click', handleCopy);

    // Theme toggle
    themeToggle?.addEventListener('click', toggleTheme);
  }

  // ========================================
  // Initialization
  // ========================================

  /**
   * Set current year in footer
   */
  function setCurrentYear() {
    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  /**
   * Initialize the application
   */
  function init() {
    initTheme();
    setCurrentYear();
    initEventListeners();
    updatePreview();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose functions globally if needed
  window.DNSProfileGenerator = {
    toggleTheme,
    updatePreview,
    getFormData,
    buildPlist
  };

})();

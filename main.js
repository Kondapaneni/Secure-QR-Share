import QRCode from 'qrcode';
import AOS from 'aos';
import CryptoJS from 'crypto-js';
import { nanoid } from 'nanoid';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Initialize AOS
AOS.init({
  duration: 800,
  once: true
});

// Generate a unique user ID
const userId = nanoid(8);
document.getElementById('userId').textContent = userId;

// Initialize QR Scanner
let html5QrcodeScanner = null;

// Store for temporary data
const tempStorage = new Map();

// Create base URL for QR codes
const baseUrl = window.location.origin + '/share/';

// Handle image upload
document.getElementById('imageUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('content').value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Handle scan button
document.getElementById('startScan').addEventListener('click', function() {
  const reader = document.getElementById('reader');
  const scanBtn = document.getElementById('startScan');
  
  if (reader.classList.contains('hidden')) {
    reader.classList.remove('hidden');
    scanBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
      </svg>
      Stop Scanning
    `;
    scanBtn.style.backgroundColor = 'var(--error-color)';
    
    // Initialize scanner if not already done
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: 250 }
      );
      initializeScanner();
    }
  } else {
    reader.classList.add('hidden');
    scanBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 9V6a2 2 0 0 1 2-2h3"></path>
        <path d="M19 6V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"></path>
        <path d="M15 2h5v5"></path>
        <path d="M22 15v5h-5"></path>
        <path d="M22 19v-2a2 2 0 0 0-2-2h-3"></path>
        <path d="M2 15v4a2 2 0 0 0 2 2h2"></path>
      </svg>
      Start Scanning
    `;
    scanBtn.style.backgroundColor = 'var(--success-color)';
    
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear();
    }
  }
});

// Encrypt data
function encryptData(data, recipientId) {
  const payload = {
    data,
    recipientId,
    timestamp: Date.now(),
    senderId: userId
  };
  return CryptoJS.AES.encrypt(JSON.stringify(payload), 'secret-key').toString();
}

// Decrypt data
function decryptData(encryptedData) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, 'secret-key');
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    return null;
  }
}

// Update timer
function updateTimer(startTime, timerElement) {
  const timeLeft = Math.max(0, 120 - Math.floor((Date.now() - startTime) / 1000));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  timerElement.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  if (timeLeft > 0) {
    requestAnimationFrame(() => updateTimer(startTime, timerElement));
  } else {
    timerElement.textContent = 'QR Code expired';
    timerElement.classList.add('expired');
  }
}

// Generate QR Code
async function generateQR(url) {
  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#4f46e5',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });
    
    const container = document.createElement('div');
    container.className = 'qr-container fade-in';
    
    const img = document.createElement('img');
    img.src = qrDataUrl;
    img.alt = 'QR Code';
    
    const urlText = document.createElement('div');
    urlText.className = 'qr-url';
    urlText.textContent = url;
    
    container.appendChild(img);
    container.appendChild(urlText);
    
    const qrOutput = document.getElementById('qrOutput');
    qrOutput.innerHTML = '';
    qrOutput.appendChild(container);
    
    // Start timer
    const timerElement = document.getElementById('timer');
    updateTimer(Date.now(), timerElement);
  } catch (err) {
    console.error(err);
  }
}

// Initialize scanner
function initializeScanner() {
  html5QrcodeScanner.render((decodedText) => {
    const key = decodedText.replace(baseUrl, '');
    const encryptedData = tempStorage.get(key);
    
    if (!encryptedData) {
      alert('QR code has expired or is invalid');
      return;
    }

    const decrypted = decryptData(encryptedData);
    if (!decrypted) {
      alert('Failed to decrypt data');
      return;
    }

    if (decrypted.recipientId !== userId) {
      alert('This QR code is not intended for you');
      return;
    }

    const timePassed = Date.now() - decrypted.timestamp;
    if (timePassed > 120000) {
      alert('Content has expired');
      return;
    }

    const scanResult = document.getElementById('scanResult');
    scanResult.innerHTML = `
      <div class="fade-in">
        <h3>Received Content:</h3>
        <p>${decrypted.data}</p>
        <p><small>From: ${decrypted.senderId}</small></p>
      </div>
    `;
  }, (error) => {
    console.warn(`QR Code scanning failed: ${error}`);
  });
}

// Handle QR generation
document.getElementById('generateBtn').addEventListener('click', async () => {
  const content = document.getElementById('content').value;
  const recipientId = document.getElementById('recipient').value;

  if (!content || !recipientId) {
    alert('Please fill in all fields');
    return;
  }

  const encryptedData = encryptData(content, recipientId);
  const key = nanoid();
  tempStorage.set(key, encryptedData);

  // Create shareable URL
  const shareUrl = `${baseUrl}${key}`;

  // Generate QR with URL
  await generateQR(shareUrl);

  // Set expiration
  setTimeout(() => {
    tempStorage.delete(key);
    const timerElement = document.getElementById('timer');
    timerElement.textContent = 'QR Code expired';
    timerElement.classList.add('expired');
  }, 120000); // 2 minutes
});

// Handle URL sharing
if (window.location.pathname.startsWith('/share/')) {
  const key = window.location.pathname.replace('/share/', '');
  const encryptedData = tempStorage.get(key);
  
  if (encryptedData) {
    const decrypted = decryptData(encryptedData);
    if (decrypted && decrypted.recipientId === userId) {
      const scanResult = document.getElementById('scanResult');
      scanResult.innerHTML = `
        <div class="fade-in">
          <h3>Received Content:</h3>
          <p>${decrypted.data}</p>
          <p><small>From: ${decrypted.senderId}</small></p>
        </div>
      `;
    }
  }
}
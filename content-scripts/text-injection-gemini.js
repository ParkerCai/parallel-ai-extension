// Text injection handler for Gemini
import { setupTextInjectionListener } from './text-injection-handler.js';

// Gemini uses Quill editor with .ql-editor class
// Send button selectors
const sendButtonSelectors = [
  'button[aria-label="Send message"]',
  'button.send-button',
  'button[mattooltip="Send message"]',
  'button:has(mat-icon[fonticon="send"])'
];

setupTextInjectionListener('.ql-editor', 'Gemini', sendButtonSelectors);

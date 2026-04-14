import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommandResponse, JarvisService } from '../service/javis';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  action?: string;
}

@Component({
  selector: 'app-jarvis-dashboard',
  imports: [FormsModule, CommonModule, MatIconModule],
  templateUrl: './jarvis-dashboard.html',
  styleUrl: './jarvis-dashboard.scss',
})
export class JarvisDashboard implements OnInit, OnDestroy {
  messages: Message[] = [];
  currentInput: string = '';
  isListening: boolean = false;
  isSpeaking: boolean = false;
  private subscription?: Subscription;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private autoMicEnabled: boolean = true; // Flag to control auto mic
  private recognition: any = null; // Store recognition instance

  constructor(
    private jarvisService: JarvisService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.speechSynthesis = window.speechSynthesis;
    }

    const welcomeText = "Hello Dhanush! I'm LYRA. How can I assist you today?";

    this.messages.push({
      text: welcomeText,
      isUser: false,
      timestamp: new Date(),
    });

    // ✅ Only speak in browser
    if (isPlatformBrowser(this.platformId)) {
      this.speakText(welcomeText);
    }

    this.subscription = this.jarvisService
      .connectWebSocket()
      .subscribe((response: CommandResponse) => {
        const replyText = response.reply;

        this.messages.push({
          text: replyText,
          isUser: false,
          timestamp: new Date(),
          action: response.action_taken,
        });

        if (isPlatformBrowser(this.platformId)) {
          this.speakText(replyText);
        }
      });
  }

  speakText(text: string) {
    if (!this.speechSynthesis) return;

    if (this.currentUtterance) {
      this.speechSynthesis.cancel();
    }

    this.currentUtterance = new SpeechSynthesisUtterance(text);

    this.currentUtterance.rate = 1.0;
    this.currentUtterance.pitch = 1.0;
    this.currentUtterance.volume = 1.0;

    this.setJarvisVoice();

    this.currentUtterance.onstart = () => {
      this.isSpeaking = true;
    };

    this.currentUtterance.onend = () => {
      this.isSpeaking = false;

      // ✅ Auto start mic after AI finishes speaking
      if (this.autoMicEnabled) {
        this.startVoiceRecognition();
      }
    };

    this.currentUtterance.onerror = () => {
      this.isSpeaking = false;

      // ✅ Auto start mic even on error
      if (this.autoMicEnabled) {
        this.startVoiceRecognition();
      }
    };

    this.speechSynthesis.speak(this.currentUtterance);
  }

  // Set a natural voice (prefers male/English voices)
  private setJarvisVoice() {
    if (!this.speechSynthesis) return;

    // Get all available voices
    const voices = this.speechSynthesis.getVoices();

    // Try to find a good JARVIS-like voice
    const preferredVoices = [
      'Google UK English Male',
      'Microsoft David Desktop',
      'Google US English',
      'Samantha', // Female but clear
      'Alex', // Male US
    ];

    for (const preferred of preferredVoices) {
      const voice = voices.find((v) => v.name.includes(preferred));
      if (voice && this.currentUtterance) {
        this.currentUtterance.voice = voice;
        break;
      }
    }

    // Fallback: Use first English voice
    if (this.currentUtterance && !this.currentUtterance.voice) {
      const englishVoice = voices.find((v) => v.lang.startsWith('en'));
      if (englishVoice) {
        this.currentUtterance.voice = englishVoice;
      }
    }
  }

  // Stop current speech
  stopSpeaking() {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  // Stop voice recognition
  stopVoiceRecognition() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  sendMessage() {
    if (!this.currentInput.trim()) return;

    // ✅ Stop listening while processing command
    this.stopVoiceRecognition();

    // Disable auto mic temporarily while processing
    this.autoMicEnabled = false;

    // Add user message
    this.messages.push({
      text: this.currentInput,
      isUser: true,
      timestamp: new Date(),
    });

    console.log('User command:', this.currentInput);

    // Send to backend
    this.jarvisService.sendCommand(this.currentInput).subscribe({
      next: (response: any) => {
        const replyText = response.reply;
        this.messages.push({
          text: replyText,
          isUser: false,
          timestamp: new Date(),
          action: response.action_taken,
        });

        // Automatically speak the response
        this.speakText(replyText);

        // Re-enable auto mic after response is processed
        this.autoMicEnabled = true;
      },
      error: (error: any) => {
        console.error('Error:', error);
        const errorText = "Sorry, I'm having trouble connecting. Please try again.";
        this.messages.push({
          text: errorText,
          isUser: false,
          timestamp: new Date(),
        });
        this.speakText(errorText);

        // Re-enable auto mic after error
        this.autoMicEnabled = true;
      },
    });

    this.currentInput = '';
  }

  startVoiceRecognition() {
    // Don't start if already listening or speaking or auto mic disabled
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isListening || this.isSpeaking || !this.autoMicEnabled) return;

    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser');
      return;
    }

    // Stop any existing recognition
    this.stopVoiceRecognition();

    this.recognition = new (window as any).webkitSpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      this.currentInput = command;
      this.sendMessage(); // This will stop listening automatically
    };

    this.recognition.onerror = () => {
      this.isListening = false;
      this.recognition = null;

      // Restart mic after error with delay
      if (this.autoMicEnabled && !this.isSpeaking) {
        setTimeout(() => {
          if (this.autoMicEnabled && !this.isSpeaking && !this.isListening) {
            this.startVoiceRecognition();
          }
        }, 1000);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.recognition = null;

      // Auto restart if not speaking and auto mic enabled
      if (this.autoMicEnabled && !this.isSpeaking) {
        setTimeout(() => {
          if (this.autoMicEnabled && !this.isSpeaking && !this.isListening) {
            this.startVoiceRecognition();
          }
        }, 500);
      }
    };

    this.recognition.start();
  }

  // Manual toggle for microphone
  toggleMicrophone() {
    if (this.isListening) {
      this.stopVoiceRecognition();
      this.autoMicEnabled = false;
    } else {
      this.autoMicEnabled = true;
      this.startVoiceRecognition();
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    // Clean up speech synthesis
    this.stopSpeaking();
    // Clean up voice recognition
    this.stopVoiceRecognition();
  }
}

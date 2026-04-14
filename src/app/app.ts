import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommandResponse, JarvisService } from '../app/service/javis';
import { CommonModule } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  action?: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  messages: Message[] = [];
  currentInput: string = '';
  isListening: boolean = false;
  isSpeaking: boolean = false;
  private subscription?: Subscription;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(
    private jarvisService: JarvisService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.speechSynthesis = window.speechSynthesis;
    }

    const welcomeText = "Hello Dhanush! I'm JARVIS. How can I assist you today?";

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
    };

    this.currentUtterance.onerror = () => {
      this.isSpeaking = false;
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

  sendMessage() {
    if (!this.currentInput.trim()) return;

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
      },
    });

    this.currentInput = '';
  }

  startVoiceRecognition() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();

    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    this.isListening = true;

    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      this.currentInput = command;
      this.sendMessage();
      this.isListening = false;
    };

    recognition.onerror = () => {
      this.isListening = false;
    };

    recognition.start();
  }
  ngOnDestroy() {
    this.subscription?.unsubscribe();
    // Clean up speech synthesis
    this.stopSpeaking();
  }
}

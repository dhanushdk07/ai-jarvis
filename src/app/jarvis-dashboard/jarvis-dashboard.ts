import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
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
export class JarvisDashboard implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;

  messages: Message[] = [];
  currentInput: string = '';
  isListening: boolean = false;
  isSpeaking: boolean = false;
  isChatPanelOpen: boolean = false;
  private subscription?: Subscription;
  private speechSynthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private autoMicEnabled: boolean = true;
  private recognition: any = null;
  private hasShownWelcome: boolean = false;
  private scrollTimeout: any = null;

  constructor(
    private jarvisService: JarvisService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit() {
    this.loadMessagesFromStorage();

    if (isPlatformBrowser(this.platformId)) {
      this.speechSynthesis = window.speechSynthesis;
      this.cancelAnyOngoingSpeech();

      if (this.messages.length === 0) {
        this.loadVoicesAndSpeak();
      } else {
        this.setupVoiceWithoutSpeaking();
      }
    } else {
      if (this.messages.length === 0) {
        const welcomeText = "Hello Dhanush! I'm LYRA. How can I assist you today?";
        this.messages.push({
          text: welcomeText,
          isUser: false,
          timestamp: new Date(),
        });
        this.saveMessagesToStorage();
      }
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

        this.saveMessagesToStorage();
        this.scrollToBottom();

        if (isPlatformBrowser(this.platformId)) {
          this.speakText(replyText);
        }
      });
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    if (this.chatMessagesContainer && this.isChatPanelOpen) {
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      this.scrollTimeout = setTimeout(() => {
        const element = this.chatMessagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }, 100);
    }
  }

  toggleChatPanel(): void {
    this.isChatPanelOpen = !this.isChatPanelOpen;
    if (this.isChatPanelOpen) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 300);
    }
  }

  private cancelAnyOngoingSpeech() {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  private setupVoiceWithoutSpeaking() {
    if (this.speechSynthesis) {
      let voices = this.speechSynthesis.getVoices();
      if (voices.length === 0) {
        this.speechSynthesis.addEventListener('voiceschanged', () => {});
      }
    }
  }

  private loadMessagesFromStorage() {
    if (isPlatformBrowser(this.platformId)) {
      const savedMessages = localStorage.getItem('lyra_messages');
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          this.messages = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          this.hasShownWelcome = true;
        } catch (e) {
          console.error('Error loading messages:', e);
        }
      }
    }
  }

  private saveMessagesToStorage() {
    if (isPlatformBrowser(this.platformId)) {
      const messagesToStore = this.messages.slice(-100);
      localStorage.setItem('lyra_messages', JSON.stringify(messagesToStore));
    }
  }

  private loadVoicesAndSpeak() {
    const welcomeText = "Hello Dhanush! I'm LYRA. How can I assist you today?";

    if (!this.hasShownWelcome) {
      this.messages.push({
        text: welcomeText,
        isUser: false,
        timestamp: new Date(),
      });
      this.saveMessagesToStorage();
      this.hasShownWelcome = true;
    }

    let voices = this.speechSynthesis?.getVoices() || [];

    if (voices.length > 0) {
      if (this.messages.length === 1 && this.messages[0].text === welcomeText) {
        this.speakText(welcomeText);
      }
    } else {
      this.speechSynthesis?.addEventListener('voiceschanged', () => {
        if (this.messages.length === 1 && this.messages[0].text === welcomeText) {
          this.speakText(welcomeText);
        }
      });
    }
  }

  speakText(text: string) {
    if (!this.speechSynthesis) return;

    if (this.currentUtterance) {
      this.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    setTimeout(() => {
      if (!this.speechSynthesis) return;

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
        this.currentUtterance = null;

        if (this.autoMicEnabled && !this.isSpeaking) {
          setTimeout(() => {
            if (this.autoMicEnabled && !this.isSpeaking && !this.isListening) {
              this.startVoiceRecognition();
            }
          }, 500);
        }
      };

      this.currentUtterance.onerror = (event) => {
        console.error('Speech error:', event);
        this.isSpeaking = false;
        this.currentUtterance = null;

        if (this.autoMicEnabled && !this.isSpeaking) {
          setTimeout(() => {
            if (this.autoMicEnabled && !this.isSpeaking && !this.isListening) {
              this.startVoiceRecognition();
            }
          }, 500);
        }
      };

      this.speechSynthesis?.speak(this.currentUtterance);
    }, 100);
  }

  private setJarvisVoice() {
    if (!this.speechSynthesis || !this.currentUtterance) return;

    let voices = this.speechSynthesis.getVoices();

    if (voices.length === 0) {
      this.speechSynthesis.addEventListener('voiceschanged', () => {
        this.setJarvisVoice();
      });
      return;
    }

    const preferredFemaleVoices = [
      'Google UK English Female',
      'Microsoft Zira Desktop',
      'Google US English Female',
      'Samantha',
      'Google français',
      'Mojave',
      'Victoria',
      'Allison',
    ];

    let selectedVoice = null;
    for (const preferred of preferredFemaleVoices) {
      selectedVoice = voices.find((v) => v.name.includes(preferred));
      if (selectedVoice) {
        this.currentUtterance.voice = selectedVoice;
        console.log('Selected female voice:', selectedVoice.name);
        break;
      }
    }

    if (!selectedVoice) {
      const femaleIndicators = [
        'female',
        'girl',
        'woman',
        'samantha',
        'zira',
        'allison',
        'victoria',
        'mojave',
      ];
      const femaleVoice = voices.find((v) =>
        femaleIndicators.some((indicator) => v.name.toLowerCase().includes(indicator)),
      );

      if (femaleVoice) {
        this.currentUtterance.voice = femaleVoice;
        console.log('Found female voice:', femaleVoice.name);
      } else {
        const englishVoice = voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) {
          this.currentUtterance.voice = englishVoice;
          console.warn('No female voice found, using default:', englishVoice.name);
        }
      }
    }
  }

  stopSpeaking() {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  stopVoiceRecognition() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }
    this.isListening = false;
  }

  sendMessage() {
    if (!this.currentInput.trim()) return;

    if (!this.isChatPanelOpen) {
      this.isChatPanelOpen = true;
    }

    this.stopVoiceRecognition();
    this.autoMicEnabled = false;
    this.stopSpeaking();

    this.messages.push({
      text: this.currentInput,
      isUser: true,
      timestamp: new Date(),
    });

    this.saveMessagesToStorage();
    this.scrollToBottom();

    console.log('User command:', this.currentInput);

    this.jarvisService.sendCommand(this.currentInput).subscribe({
      next: (response: any) => {
        const replyText = response.reply;
        this.messages.push({
          text: replyText,
          isUser: false,
          timestamp: new Date(),
          action: response.action_taken,
        });

        this.saveMessagesToStorage();
        this.scrollToBottom();
        this.speakText(replyText);

        setTimeout(() => {
          this.autoMicEnabled = true;
        }, 1000);
      },
      error: (error: any) => {
        console.error('Error:', error);
        const errorText = "Sorry, I'm having trouble connecting. Please try again.";
        this.messages.push({
          text: errorText,
          isUser: false,
          timestamp: new Date(),
        });

        this.saveMessagesToStorage();
        this.scrollToBottom();
        this.speakText(errorText);

        setTimeout(() => {
          this.autoMicEnabled = true;
        }, 1000);
      },
    });

    this.currentInput = '';
  }

  startVoiceRecognition() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isListening || this.isSpeaking || !this.autoMicEnabled) return;

    if (!('webkitSpeechRecognition' in window)) {
      console.warn('Voice recognition not supported');
      return;
    }

    this.stopVoiceRecognition();

    this.recognition = new (window as any).webkitSpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript;
      this.currentInput = command;
      this.sendMessage();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Recognition error:', event.error);
      this.isListening = false;
      this.recognition = null;

      if (this.autoMicEnabled && !this.isSpeaking && event.error !== 'no-speech') {
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

  toggleMicrophone() {
    if (this.isListening) {
      this.stopVoiceRecognition();
      this.autoMicEnabled = false;
    } else {
      this.autoMicEnabled = true;
      this.startVoiceRecognition();
    }
  }

  clearChatHistory() {
    if (confirm('Are you sure you want to clear chat history?')) {
      this.messages = [];
      this.hasShownWelcome = false;
      localStorage.removeItem('lyra_messages');
      this.stopSpeaking();
      this.stopVoiceRecognition();

      if (isPlatformBrowser(this.platformId)) {
        this.loadVoicesAndSpeak();
      } else {
        const welcomeText = "Hello Dhanush! I'm LYRA. How can I assist you today?";
        this.messages.push({
          text: welcomeText,
          isUser: false,
          timestamp: new Date(),
        });
      }
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.saveMessagesToStorage();
    this.stopSpeaking();
    this.stopVoiceRecognition();

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }
}

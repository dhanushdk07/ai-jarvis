import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommandResponse, JarvisService } from '../app/service/javis';
import { CommonModule } from '@angular/common';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  action?: string;
}

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  currentInput: string = '';
  isListening: boolean = false;
  private subscription?: Subscription;

  constructor(private jarvisService: JarvisService) {}

  ngOnInit() {
    // Welcome message
    this.messages.push({
      text: "Hello! I'm JARVIS. How can I assist you today?",
      isUser: false,
      timestamp: new Date(),
    });

    // WebSocket connection for real-time
    this.subscription = this.jarvisService
      .connectWebSocket()
      .subscribe((response: CommandResponse) => {
        this.messages.push({
          text: response.reply,
          isUser: false,
          timestamp: new Date(),
          action: response.action_taken,
        });
      });
  }
  gy() {
    debugger;
    console.log('retrdyfuyguhijo;lkjhrsfcgvjhbj');
  }

  sendMessage() {
    debugger;
    if (!this.currentInput.trim()) return;

    // Add user message
    this.messages.push({
      text: this.currentInput,
      isUser: true,
      timestamp: new Date(),
    });

    console.log(this.currentInput);

    // Send to backend
    this.jarvisService.sendCommand(this.currentInput).subscribe({
      next: (response: any) => {
        this.messages.push({
          text: response.reply,
          isUser: false,
          timestamp: new Date(),
          action: response.action_taken,
        });
      },
      error: (error: any) => {
        console.error('Error:', error);
        this.messages.push({
          text: "Sorry, I'm having trouble connecting. Please try again.",
          isUser: false,
          timestamp: new Date(),
        });
      },
    });

    this.currentInput = '';
  }

  startVoiceRecognition() {
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
  }
}

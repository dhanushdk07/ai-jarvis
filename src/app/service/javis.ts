import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

export interface CommandResponse {
  reply: string;
  action_taken: string;
  confidence: number;
  is_success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JarvisService {
  private apiUrl = 'http://localhost:8000';
  private socket$: WebSocketSubject<any>;
  
  constructor(private http: HttpClient) {
    this.socket$ = webSocket('ws://localhost:8000/ws/user1');
  }
  
  sendCommand(command: string): Observable<CommandResponse> {
    return this.http.post<CommandResponse>(`${this.apiUrl}/command`, { command });
  }
  
  sendVoiceCommand(command: string): Observable<CommandResponse> {
    return this.http.post<CommandResponse>(`${this.apiUrl}/command`, { 
      command, 
      command_type: 'voice' 
    });
  }
  
  connectWebSocket() {
    return this.socket$.asObservable();
  }
  
  sendWebSocketMessage(message: string) {
    this.socket$.next(message);
  }
}
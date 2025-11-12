import { Injectable } from '@angular/core';
import {HttpClient, HttpResponse} from "@angular/common/http";
import {Settings} from "../model/m_settings";

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  constructor(private http: HttpClient) {
  }

  fetchSettings(callback: (settings: Settings) => void) {
    this.http.post('/sync/settings', {}, {
      observe: 'response',
      responseType: 'text',
      withCredentials: true,
    }).subscribe({
      next: (res: HttpResponse<String>) => {
        callback(JSON.parse(res.body?.toString() ?? "{}"));
      },
      error: (err: HttpResponse<String>) => {
        console.error(err);
      }
    });
  }
}

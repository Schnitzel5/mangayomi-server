import {Component, model} from '@angular/core';
import {SettingsService} from "../../service/settings";
import {SettingsModel} from "../../model/m_settings";

@Component({
  selector: 'app-settings',
  imports: [],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  settings = model<SettingsModel | null>(null);

  constructor(private service: SettingsService) {
    this.service.fetchSettings(data => {
      this.settings.set(data);
      console.log(data);
    });
  }
}

import {Injectable, signal} from '@angular/core';
import {HttpClient, HttpResponse} from "@angular/common/http";
import {CookieService} from "./cookie-service";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    authState = signal<boolean>(false);

    constructor(private http: HttpClient, private cookie: CookieService) {
        this.authState.set(this.isLoggedIn());
    }

    register(email: String, password: String, callback: (res: HttpResponse<String>) => void) {
        this.http.post('/register', {
            email: email,
            password: password
        }, {
            observe: 'response',
            responseType: 'text',
        }).subscribe(res => {
            console.log("Status code: ", res.status);
            console.log("Body: ", res.body);
            callback(res);
        });
    }

    login(email: String, password: String, callback: (res: HttpResponse<String>) => void) {
        this.http.post('/login', {
            email: email,
            password: password
        }, {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe(res => {
            console.log("Status code: ", res.status);
            console.log("Body: ", res.body);
            callback(res);
        });
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    getToken(): string | null {
        return this.cookie.getCookie('id');
    }

}

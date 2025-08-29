import {Injectable} from '@angular/core';
import {HttpClient, HttpResponse} from "@angular/common/http";
import {CookieService} from "ngx-cookie-service";
import {Router} from "@angular/router";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    constructor(private router: Router, private http: HttpClient, private cookie: CookieService) {
    }

    register(email: String, password: String, callback: (res: HttpResponse<String>) => void) {
        this.http.post('/register', {
            email: email,
            password: password
        }, {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe({
            next: (res: HttpResponse<String>) => {
                callback(res);
            },
            error: (err: HttpResponse<String>) => {
                callback(err);
            }
        });
    }

    login(email: String, password: String, isRemember: boolean, callback: (res: HttpResponse<String>) => void) {
        this.http.post('/login', {
            email: email,
            password: password
        }, {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe({
            next: (res: HttpResponse<String>) => {
                if (isRemember) {
                    localStorage.setItem("isLoggedIn", "true");
                    localStorage.setItem("currentEmail", email.toString());
                } else {
                    sessionStorage.setItem("isLoggedIn", "true");
                    sessionStorage.setItem("currentEmail", email.toString());
                }
                callback(res);
            },
            error: (err: HttpResponse<String>) => {
                callback(err);
            }
        });
    }

    logout() {
        this.http.get('/logout', {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe(res => {
            console.log("Status code: ", res.status);
            console.log("Body: ", res.body);
            this.router.navigate(['/web/register']);
            sessionStorage.removeItem("isLoggedIn");
            localStorage.removeItem("isLoggedIn");
            sessionStorage.removeItem("currentEmail");
            localStorage.removeItem("currentEmail");
        });
    }

    update(email: String, password: String, passwordOld: String, callback: (res: HttpResponse<String>) => void) {
        this.http.post('/profile', {
            email: email,
            password: password,
            passwordOld: passwordOld
        }, {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe({
            next: (res) => {
                if (res.status === 200) {
                    if (localStorage.getItem("currentEmail")) {
                        localStorage.setItem("currentEmail", email.toString());
                    } else {
                        sessionStorage.setItem("currentEmail", email.toString());
                    }
                }
                callback(res);
            },
            error: (err: HttpResponse<String>) => {
                callback(err);
            }
        });
    }

    delete(callback: (res: HttpResponse<String>) => void) {
        this.http.delete('/delete', {
            observe: 'response',
            responseType: 'text',
            withCredentials: true,
        }).subscribe({
            next: (res: HttpResponse<String>) => {
                callback(res);
            },
            error: (err: HttpResponse<String>) => {
                callback(err);
            }
        });
    }

    isLoggedIn(): boolean {
        return sessionStorage.getItem("isLoggedIn") === "true" || localStorage.getItem("isLoggedIn") === "true";
    }

    getCurrentEmail(): string | null {
        return sessionStorage.getItem("currentEmail") || localStorage.getItem("currentEmail");
    }

}

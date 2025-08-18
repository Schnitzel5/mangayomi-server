import {Injectable, signal} from '@angular/core';
import {HttpClient, HttpResponse} from "@angular/common/http";

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    authState = signal<boolean>(false);

    constructor(private http: HttpClient) {
        this.authState.set(this.isLoggedIn());
    }

    register(email: String, password: String, callback: (res: HttpResponse<Object>) => void) {
        this.http.post('/api/register', {
            email: email,
            password: password
        }, {
            observe: 'response',
        }).subscribe(res => {
            console.log("Status code: ", res.status);
            console.log("Body: ", res.body);
            callback(res);
        });
    }

    login(email: String, password: String, isRemember: boolean, callback: (res: HttpResponse<Object>) => void) {
        this.http.post('/api/login', {
            email: email,
            password: password
        }, {
            observe: 'response',
            withCredentials: true,
        }).subscribe(res => {
            console.log("Status code: ", res.status);
            console.log("Body: ", res.body);
            const cookieHeader = res.headers.get("set-cookie");
            const startIdx = cookieHeader?.indexOf("id=") ?? -1;
            const endIdx = cookieHeader?.indexOf(";", startIdx) ?? -1;
            if (startIdx == -1 || endIdx == -1) {
            }
            const authToken = cookieHeader!.substring(startIdx + 3, endIdx);
            if (isRemember) {
                localStorage.setItem("token", authToken);
            } else {
                sessionStorage.setItem("token", authToken);
            }
            callback(res);
        });
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    getToken(): string | null {
        return sessionStorage.getItem("token") || localStorage.getItem("token");
    }

}

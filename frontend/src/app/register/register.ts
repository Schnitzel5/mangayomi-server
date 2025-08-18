import {Component, model, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth";

@Component({
    selector: 'app-register',
    imports: [
        FormsModule
    ],
    templateUrl: './register.html',
    styleUrl: './register.scss'
})
export class Register implements OnInit {
    EMAIL_REGEX = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
    email = model<String>('');
    password = model<String>('');
    isRemember = model<boolean>(false);
    isAccept = model<boolean>(false);

    constructor(private auth: AuthService) {
    }

    ngOnInit() {
    }

    isEmailValid(): boolean {
        return this.EMAIL_REGEX.test(this.email() as string);
    }

    isPasswordValid(): boolean {
        return this.password().length >= 8;
    }

    isFormValid(): boolean {
        return this.isEmailValid() && this.isPasswordValid();
    }

    register() {
        this.auth.register(this.email(), this.password(), _ => {
            this.auth.login(this.email(), this.password(), this.isRemember(), _ => {
            });
        });
    }

    login() {
        this.auth.login(this.email(), this.password(), this.isRemember(), _ => {
        });
    }

}

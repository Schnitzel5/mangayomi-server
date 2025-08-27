import {Component, model, OnInit} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth";
import {ToastrService} from "ngx-toastr";

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
    isAccept = model<boolean>(false);

    constructor(private auth: AuthService, private toastr: ToastrService) {
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
        return this.isEmailValid() && this.isPasswordValid() && this.isAccept();
    }

    register() {
        this.auth.register(this.email(), this.password(), res => {
            if (res.status === 200) {
                this.toastr.success("Account registered successfully!");
                this.login();
            } else if (res.status === 400) {
                this.toastr.error("Account already exists!");
            } else {
                this.toastr.error("Server error!");
            }
        });
    }

    login() {
        this.auth.login(this.email(), this.password(), res => {
            if (res.status === 400 || (res.body && res.body.includes("Account not found"))) {
                this.toastr.error("Invalid email or password!");
            } else if (res.status === 200) {
                this.toastr.success("Logged in successfully!");
            } else {
                this.toastr.error("Server error!");
            }
        });
    }

}

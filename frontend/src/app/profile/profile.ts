import {Component, model} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {AuthService} from "../../service/auth";
import {ToastrService} from "ngx-toastr";

@Component({
    selector: 'app-profile',
    imports: [
        FormsModule
    ],
    templateUrl: './profile.html',
    styleUrl: './profile.scss'
})
export class Profile {
    EMAIL_REGEX = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
    email = model<String>('');
    password = model<String>('');
    passwordOld = model<String>('');

    constructor(private auth: AuthService, private toastr: ToastrService) {
        this.email.set(auth.getCurrentEmail() ?? "");
    }

    isEmailValid(): boolean {
        return this.EMAIL_REGEX.test(this.email() as string);
    }

    isPasswordValid(): boolean {
        return this.password().length == 0 || this.password().length >= 8;
    }

    isPasswordOldValid(): boolean {
        return this.passwordOld().length == 0 || this.passwordOld().length >= 8;
    }

    isFormValid(): boolean {
        return this.isEmailValid() && this.isPasswordValid() && this.isPasswordOldValid();
    }

    updateProfile() {
        this.auth.update(this.email(), this.password(), this.passwordOld(), res => {
            if (res.status === 200) {
                this.toastr.success("Account updated!");
            } else if (res.status === 400) {
                this.toastr.error("Email already exists or password is invalid!");
            } else {
                this.toastr.error("Server error!");
            }
        });
    }

    deleteAccount() {
        this.auth.delete(res => {
            if (res.status === 200) {
                this.auth.logout();
                this.toastr.success("Account deleted!");
            } else {
                this.toastr.error("Failed to delete account!");
            }
        });
    }
}

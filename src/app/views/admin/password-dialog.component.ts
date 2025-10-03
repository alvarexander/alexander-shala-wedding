import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-password-dialog',
    standalone: true,
    imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, FormsModule],
    templateUrl: './password-dialog.component.html',
})
export class PasswordDialogComponent {
    password = '';
    private ref = inject(MatDialogRef<PasswordDialogComponent, string | null>);

    submit(): void {
        this.ref.close(this.password);
    }
    cancel(): void {
        this.ref.close(null);
    }
}

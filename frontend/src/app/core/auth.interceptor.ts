import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken;

  const cloned = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  return next(cloned).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.url.includes('/auth/login')) {
        auth.logout();
      }
      return throwError(() => err);
    })
  );
};

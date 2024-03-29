import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/accounts/0',
    pathMatch: 'full',
  },
  {
    path: 'accounts',
    loadChildren: () => import('./features/accounts/accounts.module').then((m) => m.AccountsModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}

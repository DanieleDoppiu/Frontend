import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonButton,
  IonSpinner, IonTabs, IonTabBar, IonTabButton, IonIcon, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonInput } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { Clipboard } from '@capacitor/clipboard';
import { loadStripe } from '@stripe/stripe-js';

@Component({
  selector: 'app-pagamento',
  templateUrl: './pagamento.page.html',
  styleUrls: ['./pagamento.page.scss'],
  standalone: true,
  imports: [IonInput, CommonModule, FormsModule, IonContent, IonHeader, IonTitle, IonToolbar,
    IonItem, IonLabel, IonButton, IonSpinner, IonTabs, IonTabBar,
    IonTabButton, IonIcon, RouterModule, IonCard, IonCardContent, IonCardHeader, IonCardTitle]
})
export class PagamentoPage implements OnInit {
  nomeEvento: string = '';
  eventoId: string = '';
  isLoading: boolean = false;
  appUrl: string = 'https://sivapp.it/download'; // URL per scaricare l'app
  eventoDetails: any = null;
  stripePromise = loadStripe(this.getStripePublicKey());

  constructor(
    private http: HttpClient,
    private alertController: AlertController,
    private toastController: ToastController,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.eventoId = params['eventoId'] || '';
      this.nomeEvento = params['nomeEvento'] || '';

      console.log("📌 Evento ID ricevuto nella pagina pagamento:", this.eventoId);
      console.log("📌 Nome Evento ricevuto:", this.nomeEvento);

      if (!this.eventoId || this.eventoId.trim() === '') {
        console.error('❌ Errore: eventoId non ricevuto nella pagina di pagamento');
        this.presentAlert('Errore', 'Non è stato possibile recuperare i dettagli dell\'evento.');
        return;
      }

      this.loadEventoDetails();
    });
  }



  getStripePublicKey(): string {
    // In un'applicazione reale, questa chiave verrebbe fornita dal server
    // per evitare di esporre chiavi API nel client
    return 'pk_test_51QLNJ7KFkaVWzWc9enF5jlD6s9H3MeAOEmGlpPWv6mtz1HkWAN6KK9SdPVjOLmcCi5llmIIyAOhKqV9uEr7GZOLt00v67eSLAY'; // Sostituire con la chiave pubblica reale
  }

  loadEventoDetails() {
    this.http.get(`${environment.apiUrl}/api/eventi/${this.eventoId}`)
      .subscribe(
        (data: any) => {
          this.eventoDetails = data;
        },
        (error) => {
          console.error('Errore nel caricamento dei dettagli evento:', error);
        }
      );
  }

  shareOnFacebook() {
    const shareUrl = `https://sivapp.it/evento/${this.eventoId}`;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  }

  shareOnInstagram() {
    this.presentToast('Per condividere su Instagram, copia il link e condividilo manualmente nelle tue storie.');
    this.copyEventLink();
  }

  shareOnWhatsApp() {
    const shareUrl = `https://sivapp.it/evento/${this.eventoId}`;
    const message = `Partecipa all'evento "${this.nomeEvento}": ${shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  async copyEventLink() {
    const shareUrl = `https://sivapp.it/evento/${this.eventoId}`;

    try {
      await Clipboard.write({
        string: shareUrl
      });
      this.presentToast('Link copiato negli appunti!');
    } catch (error) {
      console.error('Errore durante la copia del link:', error);
      this.presentToast('Errore durante la copia del link');
    }
  }

  condividiEvento() {
    if (!this.eventoDetails) {
      console.error("❌ Errore: eventoDetails è null!");
      alert("Errore: i dettagli dell'evento non sono ancora caricati.");
      return;
    }

    const user = JSON.parse(localStorage.getItem('user')!);
    if (!user || !user._id || !this.eventoDetails._id) {
      console.error("❌ Dati mancanti per la condivisione!");
      return;
    }

    const linkCondivisione = `https://sivapp.events/evento?eventoId=${this.eventoDetails._id}&user=${user._id}`;

    const messaggio = `🎉 Partecipa a "${this.eventoDetails.nomeEvento}" a ${this.eventoDetails.citta}! Scopri l'evento e segui ${user.username} su Sivapp! 👇\n${linkCondivisione}`;

    navigator.clipboard.writeText(messaggio).then(() => {
      alert("🔗 Link copiato! Condividilo con i tuoi amici!");
    }).catch(err => {
      console.error("❌ Errore nella copia del link:", err);
    });

    if (navigator.share) {
      navigator.share({
        title: "Evento su Sivapp",
        text: messaggio,
        url: linkCondivisione
      }).then(() => console.log("✅ Condivisione completata!"))
        .catch(err => console.error("❌ Errore nella condivisione:", err));
    }
  }

  getImageUrl(locandina: string): string {
    // Se manca l'URL dell'immagine, mostra l'immagine di default
    if (!locandina) return 'assets/default-image.jpg';

    // Se l'URL è già un URL di Firebase, lo restituiamo direttamente
    if (locandina.startsWith('https://firebasestorage.googleapis.com')) {
      return locandina; // Restituisce l'URL completo di Firebase
    }

    // Se non è un URL Firebase, trattalo come un percorso relativo (come facevamo prima)
    return `${environment.apiUrl}${locandina.startsWith('/') ? '' : '/'}${locandina}`;
  }

  async processPayment() {
    this.isLoading = true;

    try {
      const stripe = await this.stripePromise;

      if (!stripe) {
        console.error("❌ Errore: Stripe non è stato caricato correttamente.");
        this.presentAlert('Errore', 'Impossibile inizializzare il pagamento.');
        return;
      }

      const response: any = await this.http.post(`${environment.apiUrl}/api/create-payment-intent`, {
        amount: 200, // 2€ in centesimi
        eventoId: this.eventoId
      }).toPromise();

      console.log("✅ ID sessione ricevuto:", response.id);

      const { error } = await stripe.redirectToCheckout({
        sessionId: response.id
      });

      if (error) {
        throw new Error(error.message);
      }

    } catch (error) {
      console.error('❌ Errore durante il processo di pagamento:', error);
      this.presentAlert('Errore di Pagamento', 'Si è verificato un errore durante il pagamento.');
    } finally {
      this.isLoading = false;
    }
  }






  // Questa funzione viene chiamata quando l'utente ritorna dalla pagina di pagamento Stripe
  async handlePaymentSuccess() {
    try {
      // Aggiorna lo stato di approvazione dell'evento a "si"
      await this.http.put(`${environment.apiUrl}/api/eventi/${this.eventoId}/approve`, {
        approvato: 'si'
      }).toPromise();

      const alert = await this.alertController.create({
        header: 'Pagamento Completato',
        message: `Grazie per la tua donazione di 2€! L'evento "${this.nomeEvento}" è stato approvato e sarà visibile in evidenza a tutti gli utenti.`,
        buttons: [
          {
            text: 'OK',
            handler: () => {
              this.router.navigate(['/home']);
            }
          }
        ]
      });

      await alert.present();
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dello stato dell\'evento:', error);
      this.presentAlert('Errore', 'Il pagamento è andato a buon fine, ma si è verificato un problema nell\'approvazione dell\'evento. Il problema verrà risolto a breve.');
    }
  }

  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });

    await alert.present();
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });

    await toast.present();
  }
}

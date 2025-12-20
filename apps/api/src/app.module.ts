import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";

// Modules (fill these in Milestone 2+; importing now is safe once files exist)
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AddressesModule } from "./modules/addresses/addresses.module";
import { ListingsModule } from "./modules/listings/listings.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { HomeModule } from "./modules/home/home.module";
import { ActivityModule } from "./modules/activity/activity.module";
import { SearchModule } from "./modules/search/search.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { EventsModule } from "./modules/events/events.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { ChatsModule } from "./modules/chats/chats.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { StripeModule } from "./modules/stripe/stripe.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { RefundsModule } from "./modules/refunds/refunds.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { BlocksModule } from "./modules/blocks/blocks.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AdminModule } from "./modules/admin/admin.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { IdempotencyModule } from "./modules/idempotency/idempotency.module";

@Module({
  imports: [
    PrismaModule,

    // Core
    AuthModule,
    UsersModule,
    AddressesModule,

    // Marketplace
    ListingsModule,
    FavoritesModule,
    HomeModule,
    ActivityModule,
    SearchModule,
    RecommendationsModule,
    EventsModule,

    // Media + Chat
    UploadsModule,
    ChatsModule,

    // Commerce
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    StripeModule,
    PayoutsModule,
    RefundsModule,
    IdempotencyModule,

    // Safety + Social
    NotificationsModule,
    BlocksModule,
    ReportsModule,
    AdminModule,
    ReviewsModule,
  ],
})
export class AppModule {}

import { withdrawalIntentReferenceFromAmounts } from "../domain/withdrawal-limit.js";

export type WithdrawalRequestInput = {
  userId: string;
  userName: string;
  userEmail: string;
  amountKrw: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  contact: string;
  note?: string;
};

export interface WithdrawalTransaction {
  acceptedInvestmentIntentAmount(): Promise<number>;
  acceptedWithdrawalIntentAmount(): Promise<number>;
  pendingWithdrawalIntentAmount(): Promise<number>;
  save(input: WithdrawalRequestInput): Promise<unknown>;
}

export interface WithdrawalRepository {
  withUserTransaction<T>(
    userId: string,
    work: (transaction: WithdrawalTransaction) => Promise<T>
  ): Promise<T>;
}

export class RequestWithdrawalService {
  constructor(private readonly repository: WithdrawalRepository) {}

  execute(input: WithdrawalRequestInput) {
    return this.repository.withUserTransaction(input.userId, async (transaction) => {
      const [invested, withdrawn, pending] = await Promise.all([
        transaction.acceptedInvestmentIntentAmount(),
        transaction.acceptedWithdrawalIntentAmount(),
        transaction.pendingWithdrawalIntentAmount()
      ]);
      const reference = withdrawalIntentReferenceFromAmounts(
        Math.max(invested - withdrawn, 0),
        pending
      );
      if (reference.acceptedNetInvestmentIntentKrw <= 0 || input.amountKrw > reference.maxRequestIntentKrw) {
        return { status: "limit_exceeded" as const, reference };
      }
      const intent = await transaction.save(input);
      return { status: "created" as const, reference, intent };
    });
  }
}

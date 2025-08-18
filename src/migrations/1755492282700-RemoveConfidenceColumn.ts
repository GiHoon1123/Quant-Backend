import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveConfidenceColumn1755492282700 implements MigrationInterface {
    name = 'RemoveConfidenceColumn1755492282700'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bitcoin_transactions" DROP COLUMN "confidence"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bitcoin_transactions" ADD "confidence" numeric(5,4) NOT NULL DEFAULT '0'`);
    }

}

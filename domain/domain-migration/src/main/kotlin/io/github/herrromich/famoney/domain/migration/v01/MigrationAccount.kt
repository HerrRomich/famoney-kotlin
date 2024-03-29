package io.github.herrromich.famoney.domain.migration.v01

import java.time.LocalDate

data class MigrationAccounts (
    val accounts: List<MigrationAccount>
)
data class MigrationAccount(
    val budgetId: Int,
    val name: String,
    val openingDate: LocalDate,
    val tags: List<String>,
)

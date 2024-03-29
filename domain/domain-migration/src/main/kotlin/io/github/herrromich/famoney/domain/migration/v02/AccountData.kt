package io.github.herrromich.famoney.domain.migration.v02

data class AccountData(
    val id: Int,
    val name: String,
    val movements: List<MovementData>
)

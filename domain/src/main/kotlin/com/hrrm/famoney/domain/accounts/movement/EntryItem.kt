package com.hrrm.famoney.domain.accounts.movement

import java.math.BigDecimal
import javax.persistence.Column
import javax.persistence.Embeddable

@Embeddable
class EntryItem {
    @Column(name = "pos")
    var position: Int = 0

    @Column(name = "category_id")
    var categoryId: Int = 0

    @Column(name = "amount")
    var amount: BigDecimal = BigDecimal.ZERO

    @Column(name = "comments")
    var comments: String? = null
}
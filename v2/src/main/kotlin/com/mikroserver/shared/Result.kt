package com.mikroserver.shared

/**
 * Railway-oriented result type for expected failure paths.
 * Throw only for programmer errors; use [AppResult] for business/infra failures.
 */
sealed class AppResult<out T> {

    data class Ok<T>(val value: T) : AppResult<T>()
    data class Err(val error: AppError) : AppResult<Nothing>()

    val isOk: Boolean get() = this is Ok
    val isErr: Boolean get() = this is Err

    fun getOrNull(): T? = when (this) {
        is Ok -> value
        is Err -> null
    }

    fun errorOrNull(): AppError? = when (this) {
        is Ok -> null
        is Err -> error
    }

    inline fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Ok -> Ok(transform(value))
        is Err -> this
    }

    inline fun <R> flatMap(transform: (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Ok -> transform(value)
        is Err -> this
    }

    inline fun onSuccess(action: (T) -> Unit): AppResult<T> {
        if (this is Ok) action(value)
        return this
    }

    inline fun onFailure(action: (AppError) -> Unit): AppResult<T> {
        if (this is Err) action(error)
        return this
    }

    fun getOrThrow(): T = when (this) {
        is Ok -> value
        is Err -> throw AppException(error)
    }

    companion object {
        fun <T> ok(value: T): AppResult<T> = Ok(value)
        fun err(error: AppError): AppResult<Nothing> = Err(error)

        inline fun <T> catching(block: () -> T): AppResult<T> =
            try {
                Ok(block())
            } catch (e: AppException) {
                Err(e.error)
            }
    }
}

/** Thrown only when an [AppError] must propagate across a non-Result boundary. */
class AppException(val error: AppError) : RuntimeException(error.message)

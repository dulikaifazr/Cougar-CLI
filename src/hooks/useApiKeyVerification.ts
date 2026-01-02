import { useCallback, useState } from 'react'
import { verifyApiKey } from '@services/claude'

export type VerificationStatus =
  | 'loading'
  | 'valid'
  | 'invalid'
  | 'missing'
  | 'error'

export type ApiKeyVerificationResult = {
  status: VerificationStatus
  reverify: () => Promise<void>
  error: Error | null
}

export function useApiKeyVerification(): ApiKeyVerificationResult {
  // const [status, setStatus] = useState<VerificationStatus>(() => 'missing')
  // const [error, setError] = useState<Error | null>(null)

  // const verify = useCallback(async (): Promise<void> => {
  //   if (isDefaultApiKey()) {
  //     setStatus('valid')
  //     return
  //   }

  //   try {
  //     const isValid = await verifyApiKey(apiKey)
  //     const newStatus = isValid ? 'valid' : 'invalid'
  //     setStatus(newStatus)
  //     return
  //   } catch (error) {
  //     // This happens when there an error response from the API but it's not an invalid API key error
  //     // In this case, we still mark the API key as invalid - but we also log the error so we can
  //     // display it to the user to be more helpful
  //     setError(error as Error)
  //     const newStatus = 'error' as const
  //     setStatus(newStatus)
  //     return
  //   }
  // }, [])

  return {
    status: 'valid',
    reverify: async () => {},
    error: null,
  }
}

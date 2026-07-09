import { SetMetadata } from '@nestjs/common'

// Marks a route as not requiring authentication (e.g. the health probe).
export const IS_PUBLIC = 'is_public'
export const Public = () => SetMetadata(IS_PUBLIC, true)

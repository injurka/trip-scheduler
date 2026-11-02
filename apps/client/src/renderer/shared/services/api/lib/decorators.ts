export function throttle(delay: number) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    if (`${import.meta.env?.VITE_APP_REQUEST_THROTTLE}` !== 'true')
      return

    const originalMethod = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args)
      await new Promise(resolve => setTimeout(resolve, delay))

      return result
    }

    return descriptor
  }
}

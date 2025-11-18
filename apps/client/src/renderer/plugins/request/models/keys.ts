// Ключи, связанные с основным контентом путешествия
export const TRIP_INFO_KEYS = {
  FETCH_DAYS: (tripId: string) => `trip/${tripId}/days/fetch`,
  ADD_DAY: (tripId: string) => `trip/${tripId}/days/add`,
  UPDATE_DAY: (dayId: string) => `day/${dayId}/update`,

  ADD_ACTIVITY: (dayId: string) => `day/${dayId}/activity/add`,
  UPDATE_ACTIVITY: (activityId: string) => `activity/${activityId}/update`,
  REMOVE_ACTIVITY: (activityId: string) => `activity/${activityId}/remove`,
}

// Ключи, связанные с галереей
export const TRIP_GALLERY_KEYS = {
  FETCH_IMAGES: (tripId: string) => `trip/${tripId}/images/fetch`,
  UPLOAD_IMAGE: (tripId: string) => `trip/${tripId}/image/upload`,
}

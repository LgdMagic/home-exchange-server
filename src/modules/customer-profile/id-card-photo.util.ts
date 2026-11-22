/** 单张证件照片上限。超过此大小由 multer 先拒绝。 */
export const MAX_ID_CARD_PHOTO_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** 只认文件头，不信客户端声明的 Content-Type。 */
export function detectIdCardImageType(
  bytes: Buffer,
): 'image/jpeg' | 'image/png' | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= PNG_SIGNATURE.length &&
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    return 'image/png';
  }

  return null;
}

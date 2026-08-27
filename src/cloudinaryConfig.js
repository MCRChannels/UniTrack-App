// Cloudinary Configuration
export const CLOUDINARY_CLOUD_NAME = "dgxatutln";
export const CLOUDINARY_UPLOAD_PRESET = "Baboss";
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ฟังก์ชันสำหรับอัปโหลดรูปภาพโปรไฟล์ไปยัง Cloudinary
export const uploadImageToCloudinary = async (imageUri) => {
    const formData = new FormData();

    // Get file extension
    const uriParts = imageUri.split('.');
    const fileType = uriParts[uriParts.length - 1] || 'jpg';

    formData.append('file', {
        uri: imageUri,
        type: `image/${fileType}`,
        name: `profile_${Date.now()}.${fileType}`,
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data',
        },
    });

    const data = await response.json();

    if (data.secure_url) {
        return data.secure_url;
    } else {
        throw new Error(data.error?.message || 'Upload failed');
    }
};

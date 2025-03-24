## The Idea

The concept is straightforward: use a camera feed to detect when a delivery truck shows up at my house and send a notification. No more packages sitting outside for hours or getting soaked in the rain because I didn't know they were delivered.

This isn't a groundbreaking idea by any means, but it was a perfect project to get my hands dirty with TensorFlow and MediaPipe while building something useful.

## Plan

For this project, I went with a fine-tuned MobileNet_V2 model, which is a good balance between accuracy and performance for edge devices. Here's the basic architecture:

1. **The Model**: A MobileNet_V2 neural network fine-tuned to recognize three classes: USPS, UPS, and FedEx logos
2. **Input**: Video feed from an IP camera (or video files for testing)
3. **Processing**: Real-time inference on frames from the video stream
4. **Output**: Detection results with confidence scores

The beauty of using MobileNet is that it's lightweight enough to run on modest hardware. The inference script processes frames without breaking a sweat on my Ryzen 5 2600, using very little memory while keeping up with a 25fps video stream. GPU or TPU acceleration would be even faster.

## Training the Model

Training was pretty straightforward, though as with any machine learning project, data preparation took the most time:

1. Collected about 125 images (~1/3 for each delivery service)
2. Used some utility scripts to convert all images to PNG format and organize the dataset
3. Split the dataset into training and testing sets using a COCO-format dataset structure
4. Trained the model for 30 epochs using MediaPipe's model maker library

The training code itself is just a few dozen lines thanks to MediaPipe's abstraction layer over TensorFlow:

```python
import os
import json
from mediapipe_model_maker import object_detector

# Load and prepare datasets
train_data = object_detector.Dataset.from_coco_folder(train_dataset_path)
validation_data = object_detector.Dataset.from_coco_folder(validation_dataset_path)

# Configure the model
spec = object_detector.SupportedModels.MOBILENET_MULTI_AVG
hparams = object_detector.HParams(export_dir='models/mobilenet_multi_avg_1')
options = object_detector.ObjectDetectorOptions(
    supported_model=spec,
    hparams=hparams
)

# Train the model
model = object_detector.ObjectDetector.create(
    train_data=train_data,
    validation_data=validation_data,
    options=options)

# Export the trained model
model.export_model()
```

After training, I also experimented with post-training quantization to convert the model to 16-bit floating point. This is supposed to improve performance on GPUs, though I'm still testing that on my system.

## Inference Pipeline

The inference pipeline is simple:

1. Read frames from the video stream
2. Run the object detector on each frame
3. If a delivery truck is detected with sufficient confidence (>0.33), log the detection

The current code skips ahead by quarter-second intervals in the video to save processing time, but this can be adjusted based on your needs:

```python
while cap.isOpened():
    ret, frame = cap.read()

    if ret:
        # Convert frame to MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

        # Run detection on the frame
        detector.detect_async(mp_image, frame_ms)
    
        # Skip forward 1/4 second
        count += fps/4
        frame_ms += int(count*250)
        cap.set(cv2.CAP_PROP_POS_FRAMES, count)
```

## Current State and Challenges

This is very much a work in progress. Some notes on the current state:

- The model achieves decent accuracy with just 125 training images
- Inference time averages around 0.04s per frame on my CPU
- The code is functional but definitely needs some cleanup (first-time neural net trainer here!)
- Currently using video files for testing, but the goal is to connect it to an actual IP camera feed

The biggest challenge was getting a balanced dataset. Mail trucks don't exactly pose for photos, and getting good images of all three carriers in different lighting conditions and angles took some effort.

## Next Steps

The next phase is to turn this into a proper notification system:

1. Connect to an actual IP camera feed, rather than a webcam pointed out the window.
2. Add a notification module (probably push notifications to my phone)
3. Improve the model with more training data
4. Consider deploying to a Raspberry Pi for a standalone solution
5. Tune the confidence threshold further, especially if retrained with more data
6. Scrape images of mail trucks from 

## The Code

The current implementation is pretty simple. Here's a small snippet of the detection callback:

```python
def print_result(result: DetectionResult, output_image: mp.Image, timestamp_ms: int):
    score = result.detections[0].categories[0].score
    clas = result.detections[0].categories[0].category_name
    if score >= 0.33:  # Confidence threshold
        print(f'Detection result: {clas} logo found, confidence {score}%')
```

Nothing fancy, but it gets the job done. The full code is organized into a few Python modules:
- `inference.py` - Handles the main detection pipeline
- `ingest.py` - A utility for saving frames from video for dataset creation
- Various support scripts for data preparation

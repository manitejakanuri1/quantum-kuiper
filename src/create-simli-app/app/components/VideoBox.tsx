import { RefObject } from 'react';

interface VideoBoxProps {
    video: RefObject<HTMLVideoElement | null>;
    audio: RefObject<HTMLAudioElement | null>;
}

export default function VideoBox(props: VideoBoxProps) {
    return (
        <div className="aspect-video flex items-center h-[350px] w-[350px] justify-center bg-simligray">
            { }
            <video ref={props.video} autoPlay playsInline></video>
            {/* eslint-disable-next-line react-hooks/refs */}
            <audio ref={props.audio} autoPlay ></audio>
        </div>
    );
}

import { UA, WebSocketInterface } from "jssip";
import { Originator, RTCSession } from "jssip/lib/RTCSession";
import { IncomingRequest, OutgoingRequest } from "jssip/lib/SIPMessage";
import { RTCSessionListener, UAConfiguration } from "jssip/lib/UA";
import {
  createContext,
  FC,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export enum CallDirection {
  INCOMMING = "incoming",
  OUTGOING = "outgoing",
}

export enum SipStatus {
  DISCONNECTED = "sipStatus/DISCONNECTED",
  CONNECTING = "sipStatus/CONNECTING",
  CONNECTED = "sipStatus/CONNECTED",
  REGISTERED = "sipStatus/REGISTERED",
  ERROR = "sipStatus/ERROR",
}

export enum CallStatus {
  CONNECTING = "callStatus/CONNECTING",
  PROGRESS = "callStatus/PROGRESS",
  ACCEPTED = "callStatus/ACCEPTED",
  CONFIRMED = "callStatus/CONFIRMED",
  FAILED = "callStatus/FAILED",
  ENDED = "callStatus/ENDED",
}

type CallType = {
  from?: string;
  to?: string;
  direction?: CallDirection;
  status?: CallStatus;
  fromName?: string;
  toName?: string;
};

export type AsteriskType = {
  ua: UA;
  sipStatus: SipStatus;
  callUser: (number: string) => void;
  leaveCall: () => void;
  clearCall: () => void;
  answerCall: () => void;
  callSession: RTCSession | undefined;
  call: CallType | null;
  timer: number;
  remoteRef: RefObject<HTMLAudioElement>;
};

const AsteriskContext = createContext<AsteriskType | null>(null);

const AsteriskProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [sipStatus, setSipStatus] = useState<SipStatus>(SipStatus.DISCONNECTED);

  const sessionRef = useRef<RTCSession>();

  const [call, setCall] = useState<CallType | null>(null);

  const remoteRef = useRef<HTMLAudioElement>(null);

  const uaConfig: UAConfiguration = useMemo(
    () => ({
      sockets: [new WebSocketInterface("wss://pbx.fast-voip.cloud:443/ws")],
      uri: `005610374690348@fast-voip.cloud`,
      password: `h4YbyGudOElKcVC1`,
      register: true,
      realm: "pbx.fast-voip.cloud",
    }),
    []
  );

  const ua = useMemo(() => new UA(uaConfig), [uaConfig]);

  const _setCall = (params: Partial<CallType>) =>
    setCall((prev) => ({ ...prev, ...params }));

  const newRTCSession = useCallback<RTCSessionListener>(
    (listener: {
      originator: Originator;
      request: IncomingRequest | OutgoingRequest;
      session: RTCSession;
    }) => {
      console.log({ ...listener });
      const { originator, session, request } = listener;

      // setOpenCall(true);
      if (sessionRef.current) {
        session.terminate({
          status_code: 486,
          reason_phrase: "Busy here",
        });
      }

      sessionRef.current = session;

      // if (session.remote_identity.uri.user.startsWith("0")) {
      //   setCallType(Type.CUSTOMER);
      // } else {
      //   setCallType(Type.STAFF);
      // }

      if (originator === "local") {
        _setCall({
          direction: CallDirection.OUTGOING,
        });
        // session.connection.addEventListener("track", (event) => {
        //   console.log("Connection stream: ", event.streams[0]);
        //   if (remoteRef.current) {
        //     remoteRef.current.srcObject = event.streams[0];
        //     remoteRef.current.muted = false;
        //   }
        // });
      } else if (originator === "remote") {
        // if (ringtoneRef && ringtoneRef.current) {
        //   ringtoneRef.current.play();
        // }

        _setCall({
          direction: CallDirection.INCOMMING,
          from: request.from.uri.user,
        });
        // session.on("peerconnection", function (e) {
        //   e.peerconnection.addEventListener("track", function async(event) {
        //     console.log("Session stream: ", event.streams[0]);
        //     if (remoteRef.current) {
        //       remoteRef.current.srcObject = event.streams[0];
        //       remoteRef.current.muted = false;
        //     }
        //   });
        // });
      }

      session.on("connecting", ({ request }) => {
        _setCall({
          status: CallStatus.CONNECTING,
          from: request.from.uri.user,
          fromName: request.from.display_name,
          to: request.to.uri.user,
          toName: request.to.display_name,
        });
      });
      session.on("progress", () => {
        console.log("session in progress");

        _setCall({ status: CallStatus.PROGRESS });
      });
      session.on("accepted", function () {
        console.log("session accepted");

        _setCall({ status: CallStatus.ACCEPTED });

        const streams = session.connection.getRemoteStreams();
        console.log("streams", streams);
        if (remoteRef.current) {
          remoteRef.current.srcObject = streams[0];
          remoteRef.current.muted = false;
        }
      });
      session.on("confirmed", function () {
        console.log("session confirmed");
        // if (ringtoneRef && ringtoneRef.current) {
        //   ringtoneRef.current.pause();
        //   ringtoneRef.current.currentTime = 0;
        // }

        _setCall({ status: CallStatus.CONFIRMED });
      });

      session.on("failed", function (e) {
        console.log("session failed: ", e);
        // if (ringtoneRef && ringtoneRef.current) {
        //   ringtoneRef.current.pause();
        //   ringtoneRef.current.currentTime = 0;
        // }

        _setCall({ status: CallStatus.FAILED });

        if (session && session.connection) {
          session.connection.getSenders().forEach((sender) => {
            if (sender.track) {
              sender.track.stop();
            }
          });
        }
      });
      session.on("ended", function () {
        console.log("session ended");
        // if (ringtoneRef && ringtoneRef.current) {
        //   ringtoneRef.current.pause();
        //   ringtoneRef.current.currentTime = 0;
        // }

        _setCall({ status: CallStatus.ENDED });

        if (session && session.connection) {
          session.connection.getSenders().forEach((sender) => {
            if (sender.track) {
              sender.track.stop();
            }
          });
        }
      });
    },
    []
  );

  const listenEvents = useCallback(
    (_ua: UA) => {
      _ua.on("connecting", () => {
        console.log("agent is connecting", SipStatus.CONNECTING);
        setSipStatus(SipStatus.CONNECTING);
      });
      _ua.on("connected", () => {
        console.log("agent is connected", SipStatus.CONNECTED);
        setSipStatus(SipStatus.CONNECTED);
      });
      _ua.on("disconnected", function () {
        console.log("agent is disconnected", SipStatus.ERROR);
        setSipStatus(SipStatus.ERROR);
      });
      _ua.on("registered", function () {
        console.log("Connect to asterisk successfully", SipStatus.REGISTERED);
        setSipStatus(SipStatus.REGISTERED);
      });
      _ua.on("unregistered", function () {
        console.log("agent is unregistered", SipStatus.DISCONNECTED);
        setSipStatus(SipStatus.DISCONNECTED);
      });
      _ua.on("registrationFailed", function (e) {
        console.log("agent register failed : " + e.response);
        setSipStatus(SipStatus.ERROR);
      });

      _ua.on("newRTCSession", newRTCSession);
    },
    [newRTCSession]
  );

  useEffect(() => {
    if (!ua) return;

    ua.start();

    listenEvents(ua);

    return () => {
      ua.stop();
    };
  }, [listenEvents, ua]);

  const callUser = useCallback(
    (number: string) => {
      if (ua) {
        const mediaConstraints = { audio: true, video: false };
        const rtcSession = ua.call(number, {
          mediaConstraints,
          pcConfig: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          },
        });

        sessionRef.current = rtcSession;
      }
    },
    [ua]
  );

  const leaveCall = useCallback(() => {
    if (sessionRef.current)
      sessionRef.current.terminate({ cause: "CANCELED", status_code: 487 });
  }, []);

  const answerCall = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: {
          iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
          iceTransportPolicy: "all",
          rtcpMuxPolicy: "require",
        },
      });
    }
  }, []);

  const clearCall = useCallback(() => {
    leaveCall();
    sessionRef.current = undefined;
    setCall(null);
  }, [leaveCall]);

  return (
    <AsteriskContext.Provider
      value={{
        ua,
        call,
        callSession: sessionRef.current,
        sipStatus,
        callUser,
        answerCall,
        clearCall,
        leaveCall,
        remoteRef,
        timer: 0,
      }}
    >
      {children}
    </AsteriskContext.Provider>
  );
};

export default AsteriskProvider;

export const useAsterisk = () => {
  const context = useContext(AsteriskContext);

  if (!context) {
    throw Error("Can not find AsteriskProvider");
  }

  return context;
};
